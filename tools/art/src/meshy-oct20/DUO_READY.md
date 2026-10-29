# Kohaku & Tsubaki (duo "Prism Battery"): game-ready assets (READY to drop in)

Status: **the assets are ready. The duo unit itself is not built yet.** The pack has two battle chibis made from their real art-wave
Meshy models (re-weighted, re-baked, LOD, eyes, five clips each) and the pair portrait set in the repo's naming (split card).
They go in now as plain assets and change nothing that a player can see. The duo runtime (one base, two figures) comes later
with the unit (DUO_LR_DESIGN §4).
Base for every path and the patch: `origin/feature/roster-wave` @ `75a3ada`. Nothing in `/home/user/sakura-game` or any worktree
was edited. No Meshy job was sent (0 credits).

All paths below were relative to the Oct 20 export folder. In this folder the four model files sit next to this note, the patch is in `patches/duo/`, and the portraits are already in the repo (`public/art/portraits/kohaku_tsubaki-*`).

## 1. Files to add to the repo

| source (this folder) | repo path | bytes | vs Hikari |
|---|---|---|---|
| `models/kohaku.glb` | `public/models/characters/kohaku.glb` | 1,128,056 (1.13 MB) | Hikari 1,312,464 (1.31 MB): 86 % |
| `models/kohaku.lod.glb` | `public/models/characters/kohaku.lod.glb` | 537,844 (0.54 MB) | Hikari 599,012 (0.60 MB): 90 % |
| `models/tsubaki.glb` | `public/models/characters/tsubaki.glb` | 1,229,552 (1.23 MB) | 94 % |
| `models/tsubaki.lod.glb` | `public/models/characters/tsubaki.lod.glb` | 568,944 (0.57 MB) | 95 % |
| `portraits/kohaku_tsubaki-full.webp` (768×1024) | `public/art/portraits/kohaku_tsubaki-full.webp` | 133,748 | |
| `portraits/kohaku_tsubaki-card.webp` (300×500, **split card**) | `public/art/portraits/kohaku_tsubaki-card.webp` | 46,592 | test cap 80 KB |
| `portraits/kohaku_tsubaki-bust.webp` (512×512) | `public/art/portraits/kohaku_tsubaki-bust.webp` | 70,552 | |
| `portraits/kohaku_tsubaki-thumb.webp` (160×160) | `public/art/portraits/kohaku_tsubaki-thumb.webp` | 11,022 | test cap 20 KB |
| `portraits/kohaku_tsubaki-cut.webp` (650×1000, RGBA) | `public/art/portraits/kohaku_tsubaki-cut.webp` | 148,668 | |
| `portraits/kohaku_tsubaki-cut-s.webp` (234×360, RGBA) | `public/art/portraits/kohaku_tsubaki-cut-s.webp` | 40,114 | |

The pair together costs 2.36 MB full / 1.11 MB LOD. That is 1.8× one Hikari, for two figures that each show at 85 % on one base.

**Props: none as separate meshes, as the design says.** Both chibis are built with empty hands. The gear is part of each mesh and
is re-weighted so it holds its shape:
- Kohaku's prism emitter beside her left shoulder: rigid on `chest`.
- Tsubaki's mortar tube: only its two ends are geometry (the middle is inside the hair shell). The muzzle end above her left
  shoulder is rigid on `head`, and the base below her left hand is rigid on `hips`.
- Tsubaki's binoculars stay on the vest (spine).

The FX code gets the gear's positions from `asset.extras.anchors` (§2.4).

Model detail:
- Full: 20.0k tris (Kohaku 17,097 verts, Tsubaki 18,831), base colour 1024² (baked at 2048²) + metal/roughness 1024² + normals 1024², all WebP.
- LOD: 9.0k tris, base 1024² + metal/roughness 512².
- Skeleton: one per girl, 25 joints (the renamed Meshy humanoid + a floor `root`).
- Clips, the same in full and LOD:

  | clip | Kohaku | Tsubaki |
  |---|---|---|
  | `idle` | 1.5 s | 1.5 s |
  | `walk` | 0.958 s | 0.958 s |
  | attack | `attack_beam` 0.6 s | `attack_mortar` 0.6 s |
  | `cheer` | 1.2 s | 1.2 s |
  | `hurt` | 0.4 s | 0.4 s |

  `victory` and `pickup` fall back to `cheer` in the runtime.
- `asset.extras`:
  - `height 1.224` (Hikari's battle height; the duo layout draws each girl at 85 %)
  - `unitScale 1.44`, `style textured`, `source meshy`
  - `weaponKind` `beam` / `mortar` (information only; nothing in `src` reads it)
  - `duo: 'kohaku_tsubaki'`
  - `eyes` (two boxes + lid colours + `hairGuard`)
  - `anchors`

## 2. Registry lines

`patches/kohaku_tsubaki-assets.patch` holds items 1 to 3. Apply it with `git apply patches/kohaku_tsubaki-assets.patch`, then copy the ten
binaries above. It applies cleanly both before and after Noa's `noa-integration.patch`; both orders were tested.

1. **Models manifest** (`public/models/characters/manifest.json`) gets two entries, inserted in sorted key order with the tool's
   field order. They are model assets, not units: like the `sentinel-*` and `future-*` entries, nothing loads them until the duo runtime asks.
   ```json
   "kohaku":  { "file": "kohaku.glb", "size": 1128056, "animations": ["attack_beam", "cheer", "hurt", "idle", "walk"],
                "vertices": 17097, "triangles": 19997, "source": "meshy",
                "lod": "kohaku.lod.glb", "lodSize": 537844, "lodVertices": 8411, "lodTriangles": 8997 },
   "tsubaki": { "file": "tsubaki.glb", "size": 1229552, "animations": ["attack_mortar", "cheer", "hurt", "idle", "walk"],
                "vertices": 18831, "triangles": 19992, "source": "meshy",
                "lod": "tsubaki.lod.glb", "lodSize": 568944, "lodVertices": 9350, "lodTriangles": 8989 }
   ```
2. **`src/art/portraits.js`** `PORTRAIT_DATA` gets this line (with a three-line comment, placed after `raika` so it does not touch Noa's hunks):
   `kohaku_tsubaki: { face: [51, 29], cut: 0.65 },`
   - `face` is the midpoint of the two faces in the full illustration (Kohaku [36, 29], Tsubaki [66, 29]).
   - `cut` is the stand's width / height (650 / 1000), inside the test's 0.3–0.8 range, with no frame edges.
3. **New test `tests/models/duo-members.test.js`**: `glb.test.js` walks `UNITS`, so it never sees these two assets. This test checks both
   GLBs the same way, minus the sword: manifest, size caps, extras, clip lengths, bones, WebP, normals only on the full model,
   mirrored eye pair, guard and anchors.
4. **`src/models/figurine.js`: both GLBs need the per-figure eye guard (`figGuard` from `extras.eyes.hairGuard`) that Noa's patch
   adds (her §2.4). Ship them with or after that patch.** Without it the blink still works. But the runtime then falls back to
   Hikari's pink-hair rule:
   - Tsubaki's navy bang strands that cross the eye boxes get painted over while her eyes are closed.
   - The part of Kohaku's gold monocle rim that lies inside her left eye box disappears while she blinks.

   The guards stored here:
   - Tsubaki keeps navy (hue 221.5–249.4°, any saturation): 99.8 % of the bang texels inside the boxes, 0.7 % of the eye texels.
   - Kohaku keeps gold (hue 26–47°, sat ≥ 0.463, val ≥ 0.223): 99.6 % of the monocle rim texels, 0 % of the eye texels.

   Kohaku's guard holds gold, not her hair, because her light-lavender bangs and the light parts of her violet irises are the same
   colour. No colour rule can keep one and still close the other, so her eye boxes stop under the bangs instead (§4).

**Outfit / skin entries: none now.** Once the duo UnitDef (`kohaku_tsubaki`) lands, `src/data/skins.js` generates
`kohaku_tsubaki_default` with `asset: 'kohaku_tsubaki'` by itself. There is no `kohaku_tsubaki.glb`, on purpose. The duo builder then needs:
- a duo table in `src/models` that maps asset `kohaku_tsubaki` to the two member assets (layout in §2.3), used by `buildChibi` and by
  `preloadModels` (otherwise it requests `kohaku_tsubaki.glb`, gets a 404 and falls back to the procedural doll);
- in `tests/models/glb.test.js`, `GLB_UNITS` must skip duo units (`!u.duo`), and `GLB_UNIT_COUNT` stays as it is. The member files
  are covered by `duo-members.test.js`.

No palette or other data edits: nothing under `src/sim`, saves or `src/online/coop` changes.

### 2.3 Duo layout (verified in the renders)

- One round base, radius 0.5 (the hero footprint). Each girl is a child group at **scale 0.85**, so 1.04 battle units tall.
- **Recommended order: Tsubaki on the left (x −0.28), Kohaku on the right (x +0.28). Each is turned 12° outward**
  (Tsubaki yaw −12°, Kohaku +12°), with z ±0.02.
- Why the order is swapped from the portrait: Kohaku's emitter sits beside her left shoulder. In the portrait order (Kohaku left), the
  emitter lands on Tsubaki's cheek from the 48° camera. Swapped, both faces stay clear, the emitter is on the outside and the mortar
  sits behind, between them (`renders/battle4_idle.png`, `renders/duo_front.png`). The battle camera can turn anyway, so left and right
  are not fixed in play.
- If the portrait order is preferred: Kohaku x −0.30 with z +0.08 (in front), Tsubaki x +0.30 with z −0.08. The emitter then reads,
  but it sits right next to Tsubaki's face (`renders/battle4_portraitorder.png`).
- One selection ring round both. Each girl plays her own `attack_*` when her own weapon fires, and both play `cheer` for Prismfall (§1.6).

### 2.4 FX anchors (`asset.extras.anchors`, stored glTF position space like `extras.eyes`; bind pose)

| anchor | bone | pos | dir | what |
|---|---|---|---|---|
| Kohaku `beam` | `chest` | [0.2696, 0.4852, −0.0695] | [0, 0, 1] (her front) | centre of the emitter's violet lens (front face) |
| Tsubaki `muzzle` | `head` | [0.2784, 0.5529, −0.0109] | [0.589, 0.808, 0.024] | the open end of the mortar tube above her left shoulder |

The runtime turns `pos` into a bone-local offset once (the bone's inverse bind matrix) and reads its world position each frame.
Both bones carry the chin-up, so the lens and the muzzle follow the clips.

## 3. Verification done

- **Tests:** a scratch export of roster-wave `75a3ada` with the patch, the four GLBs and the six portraits:
  `vitest run tests/models/{api,duo-members,figurine,glb,highlight,skins,standins}.test.js tests/systems/first-impressions.test.js
  tests/data/skins.test.js tests/systems/skins.test.js` gave **10 files, 147 tests passed** (`enemies.test.js` was left out: its GLBs
  were not exported).
- **Co-op sim id** in that tree: **`15a8b44beab1` before and after**. None of the changed files are hashed.
- **`work/scripts/check_glb.mjs`** (the `glb.test.js` Meshy checks without the sword) passes for all four files.
- **Renders** use a copy of the roster-wave `src/models` (`figurine.js` with Noa's hair-guard patch, nothing else edited), the repo's
  figurine material, the texture-tinted hull outline, the eye states, `themes.js` BASE battle lights placed like `BattleRenderer`, and
  the 48° orthographic camera at 66 px for 1.224:
  - `renders/kohaku_tsubaki-import-sheet.png`: the overview
  - `renders/battle1.png`, `renders/battle1_lod.png`: 1× with Aoi and Hikari (full and LOD)
  - `renders/battle4_idle.png`, `renders/battle4_atk_k.png`, `renders/battle4_atk_t.png`, `renders/battle4_cheer.png`: about 4× (3.6×) next to Hikari
  - `renders/battle4_portraitorder.png`: the alternative order
  - `renders/{k,t}_{atk,cheer,hurt,walk}48.png`: each clip sampled at 48°
  - `renders/{k,t}_faces.png`: open, blink, happy and hurt eyes at student-viewer close-up
  - `renders/{k,t}_turn.png`: front, 3/4, side and back
  - `renders/duo_front.png`, `renders/duo_q34.png`: the pair on its base
  - `renders/portraits-final.png`, `renders/portrait-emitter-mark-4x-before-after.png`: the portrait set and the mark fix
- **What the renders show:**
  - **Eyes:** both girls' eyes read at 1× and 4× from the 48° camera. Kohaku's are clear of her straight bangs, and Tsubaki's are visible
    under the cap visor.
  - **Closed eyes:** the eye fully closes in all three states (blink, happy, hurt). Bangs and the monocle rim stay as painted.
  - **Attacks:** neither hand ever crosses a face at 48°:
    - Kohaku's "there!" point goes out beside her chin.
    - Tsubaki's fire signal comes up beside her cheek, then the mortar recoil dips her and bobs the cap.

## 4. What the import did (reproducible, scratch only)

`work/meshy/build_duo.py` is a copy of `tools/meshy/build_meshy_chibi.py` (via Noa's profile build). The per-girl settings are in
`work/meshy/lib/profiles.py`. Rebuild with:

```
cd work && nice python3 -I meshy/build_duo.py --girl kohaku --source src/kohaku-rigged.glb --clips src/meshy-library-clips.glb --out out/b5
cd work && nice python3 -I meshy/build_duo.py --girl tsubaki --source src/tsubaki-rigged.glb --clips src/meshy-library-clips.glb --out out/b5
```

Each build takes about 2.5 min under the shared load.

- **Scale, rig scale and centring** (`lib/prep.py`):
  - The Armature's 0.01 scale is applied, and the 0.9 m figure is scaled to the tool's 1.7 m working size, so every transform is identity.
  - The stray Meshy take is dropped.
  - New: each girl is **centred on her own hips**. Meshy centres the bounding box, which includes the gear, so Kohaku's body was
    5.7 cm (at 0.9 m) right of the origin. That put the face box, the eye pair and the turn axis off-centre.
  - Bones get readable names, plus a floor `root`.
- **Re-weighting** (`lib/reweight.py`, new). Meshy put almost nothing on the spine:
  - All the hair down to the waist, the collar and capelet, and Kohaku's emitter followed `head`.
  - The side hair, the emitter and both mortar ends partly followed the arms and hands.
  - The vest and binoculars followed the thighs.

  As it was, the chin-up swung the waist-long hair forward into the back, and an arm raise dragged hair and gear with it. The fixes:
  - `head` weight below the chin moves to `chest` (a smooth nape blend).
  - Arm weight farther than 7.5–12 cm (working) from the arm bones moves to `chest`.
  - Thigh weight above the skirt moves to `hips` / `spine`.
  - On the skirt, 45 % of the thigh weight moves to `hips` (75 % at the back), so steps don't push it through the hair.
  - The gear is rigid on one bone. Tsubaki's mortar ends are picked by Meshy's original dominant bone, so the hair round them is not caught.
- **Mesh and bake:** welded, then decimated to 20k / 9k tris with the face and collar bow protected (per-girl boxes). Fresh xatlas UVs,
  face at 2× density. Bake sources are found by socket links (Meshy names its images `Image_0` / `Image_1`). Skin and face normals are flattened.
- **Hair clean-up** (`lib/hair_duo.py`), on Meshy's head zone only (never the blazer or skirt, which share the hair colours):
  - Both girls: a 3×3 de-speckle at 50 %. On Tsubaki this also cleans her cap.
  - Kohaku also gets hue −6° and saturation ×0.86, so her lavender reads closer to the portrait's periwinkle and less pink-lilac in battle.
- **Eyes** (`lib/eyes.py`):
  - Per-girl iris and hair finders (violet + lavender for Kohaku, honey-gold + navy for Tsubaki).
  - The boxes are mirrored about x = 0 (the test wants a symmetric pair).
  - The guard is chosen from three shapes plus a grid search, scored against the eye texels.
  - Kohaku's boxes stop 4 mm (working) under the lowest bang tips over the middle of each eye. Her gold monocle rim is kept out of the
    box measurement and protected by the guard.
  - The eye-area normals are smoothed, so no iris bulge shows under a closed lid.
- **Clips** (`lib/clips_duo.py`):
  - `idle` and `walk` come from the Meshy library, retargeted onto the same skeleton. The walk uses a 70 % chibi stride.
  - `attack_*`, `cheer` and `hurt` are authored with 2-bone IK. Hand targets stay in front of the body and clear of the gear:
    Kohaku's left arm never goes out to the side under the emitter, and Tsubaki's signal hand stays clear of the mortar's muzzle.
  - **Chin-up in every clip: Kohaku 11°, Tsubaki 15°** (spine 20 % / neck 42 % / head 38 %). Tsubaki needs more because of the cap visor.
- **Portraits** (`work/scripts/`):
  - Checked at 2–4× for seams and edit marks. The master has no local edits, and the cut-out edges have no halo. Two marks were fixed:
    - a small pseudo-letter engraving on the side of Kohaku's emitter (a generation artifact that reads like text), inpainted from the
      panel round it in the master and the cut master (`emitter_mark_fix.py`);
    - a 6 px stray matte speck under the boots, dropped.
  - **Card = split card** (`make_portraits.py`): Kohaku's half and Tsubaki's half, each framed on her own face (0.9× master, head top
    at about 8 %), meeting at a seam with the UI's slant (`--skew: -8deg`). The seam is a soft white band with a faint shadow. Her face is
    then about 1.7× larger than in the plain crop.
  - **Bust and thumb are one continuous crop** with both faces in the upper third. The pair is one painted scene, so a seam there only
    cut through it. The split versions are in `portraits/alt/` (`*-bust.split.webp`, `*-thumb.split.webp`), next to the art wave's plain
    card (`*-card.plain.webp`).
  - `full`, `cut` and `cut-s` keep the art-wave boxes. Nothing is upscaled.

## 5. Not finished / known

- **The duo unit and its runtime are not built:** UnitDef, sim weapons, the base, the duo model builder, attack FX (beam, shells,
  shards), LR look, tower bar and panel. This pack only gives them the assets (§2.3 layout, §2.4 anchors).
- **`figurine.js` guard patch (Noa's) must ship first or together** (§2 item 4).
- **Rig:** no hair, cap or capelet bones, so there is no secondary motion. The hair below the nape moves with the chest as one sheet,
  and the skirts swing a little with the softened thigh weights.
- Tsubaki's mortar shows only its two ends; the middle is buried in her hair (from the art wave). The base end at her hip is rigid on
  `hips`, the muzzle on `head`. The middle is not geometry, so it cannot bend, but in a strong head turn the two ends can drift apart by a
  centimetre or two.
- **Blink corners:** Kohaku's boxes can still paint over a few texels of her cheek-length side locks at the outer eye corners while
  blinking. Tsubaki's guard keeps 0.7 % of her eye texels, a faint bluish eye-white shading inside a closed eye. In close-ups the lid
  patch reads a touch lighter than the cheek, as on Hikari and Noa. None of this shows at battle size.
- **Size:** at 0.85 each the girls are smaller than Hikari, by design. Tsubaki's body is about 10 % shorter than Kohaku's because Meshy fit
  her cap into the same 0.9 m. Their heads match in size, so they read as one pair.
- **Cut-out stand:** the floating prism above Kohaku's raised hand and the light shards are not in the stand (the art-wave matte), so
  her hand is open and empty.
- **Optional docs:** a "Kohaku & Tsubaki" paragraph for `docs/MODELS.md` under "Imported Meshy figures", covering the hip centring, the
  re-weighting, the gear bones, the chin-up angles, `extras.anchors` and the gold guard. `work/meshy/lib/{prep,reweight,hair_duo,anchors}.py`
  and the `eyes.py` options (`guard_from`, `top_win`, `symmetrize`, value-floor and grid guards) could move into `tools/meshy/lib` when
  the next Meshy girl lands.
- **Housekeeping:** early on, one `git fetch --dry-run` ran in `/home/user/sakura-game` (it changes no refs and no files). The shared disk
  was 100 % full during the run, so the scratch export and old builds were deleted afterwards. The rebuild sources are kept in `work/src/`.
- **Commit message** for the integrator: end it with exactly
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01V3cmFg3aKCuDQGLA9Topgo
  ```
