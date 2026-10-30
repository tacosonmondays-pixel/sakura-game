# Tenka: game-ready import (READY)

Status: **ready to drop in when her unit lands.** This folder holds her battle chibi (full + LOD), the coilgun as its own GLB on a
hand socket, and her six portrait files. It also has the registry lines and the small runtime, test, tool and doc patches.
Her kit and unit row are **not** included; they wait for the tower-ability system on `feature/abilities`.

- Base for every patch: `feature/abilities` @ `86c62a3`. These files are byte-identical there and on `claude/sakura-sentinels` @ `84ebdeb`.
- Nothing in `/home/user/sakura-game` or in any worktree was touched.
- No Meshy job was sent (0 credits). All checks ran in scratch exports.

All source paths below were relative to the Oct 20 export folder. In this folder the three model files sit next to this note, the patches are in `patches/tenka/`, and her portraits are already in the repo (`public/art/portraits/tenka-*`).

## 1. Files to add to the repo

| source (this folder) | repo path | bytes | vs Hikari |
|---|---|---|---|
| `models/tenka.glb` | `public/models/characters/tenka.glb` | 1,329,992 (1.33 MB) | 1,312,464 (1.31 MB): +1.3 % |
| `models/tenka.lod.glb` | `public/models/characters/tenka.lod.glb` | 644,692 (0.64 MB) | 599,012 (0.60 MB): +7.6 % |
| `models/tenka-coilgun.glb` (prop) | `public/models/characters/tenka-coilgun.glb` | 136,820 (0.13 MB) | (Hikari's sword is inside her GLB) |
| `portraits/tenka-full.webp` 768×1024 | `public/art/portraits/tenka-full.webp` | 93,980 | 119,254 |
| `portraits/tenka-card.webp` 300×500 | `public/art/portraits/tenka-card.webp` | 36,932 | 35,268 (test cap 80 KB) |
| `portraits/tenka-bust.webp` 512×512 | `public/art/portraits/tenka-bust.webp` | 52,042 | 51,844 |
| `portraits/tenka-thumb.webp` 160×160 | `public/art/portraits/tenka-thumb.webp` | 9,492 | 8,136 (test cap 20 KB) |
| `portraits/tenka-cut.webp` 383×1000 RGBA | `public/art/portraits/tenka-cut.webp` | 85,696 | 123,780 |
| `portraits/tenka-cut-s.webp` 138×360 RGBA | `public/art/portraits/tenka-cut-s.webp` | 22,824 | 29,386 |

**Download weight.** Full model plus coilgun is 1.47 MB, against Hikari's 1.31 MB. LOD plus coilgun is 0.78 MB, against 0.60 MB. One coilgun file serves both detail levels and loads once.

**Geometry.**
- Full: 19,985 tris / 18,834 verts. Base colour is 1024² (baked at 2048²), plus metal/roughness and normals at 1024², all WebP.
- LOD: 8,984 tris / 9,947 verts. Base colour 1024² plus metal/roughness 512².
- Coilgun: 3,000 tris. Base colour 512² (baked at 1024²) plus metal/roughness 256².
- Draw calls per instance: 4 (body, outline, gun, gun outline), the same as Hikari.

**Clips.** `idle` 1.5 s, `walk` 0.97 s, `attack_rifle` 0.6 s, `cheer` 1.2 s, `hurt` 0.4 s. `victory` and `pickup` fall back to `cheer` in the runtime.

**`asset.extras`.**
- `height 1.224` (Hikari's battle height; it reads right next to her)
- `unitScale 1.44`, `weaponKind 'rifle'`, `chinUp 14`
- `eyes`: mirrored boxes plus `hairGuard { hue: [180, 260], sat 0.6, val 0.12 }`
- `props: [{ socket: 'prop_coilgun', bone: 'hand_R', file: 'tenka-coilgun.glb' }]`

## 2. Registry lines and patches (`patches/`)

`patches/tenka-integration.patch` holds everything below as one patch: `git apply` it on `feature/abilities`, then copy the nine binaries.
The same changes also come split, so they can land separately:

| patch | what |
|---|---|
| `1-figurine-hairguard.patch` | `src/models/figurine.js`: per-figure hair guard for the closed eyes. **Required.** See the note below. |
| `2-glbChibi-props.patch` | `src/models/glbChibi.js`: prop GLBs on sockets. **Required for the coilgun.** See below. |
| `3-registry.patch` | the models manifest entry and the `portraits.js` line |
| `4-test-docs.patch` | `tests/models/glb.test.js` (hand gear generalised + prop checks) and the Tenka section in `docs/MODELS.md` |
| `4b-glb-test-on-roster-wave-after-noa.patch` | the same test change for `feature/roster-wave` once Noa's patch is in |
| `5-tools-meshy.patch` | `tools/meshy`: `--profile`, Tenka's profile and clips, the prop tool |

**Models manifest.** Add this entry to `public/models/characters/manifest.json`. Keys are sorted, as the tool writes them; it is also in `models/manifest-entry.json`:
```json
"tenka": { "file": "tenka.glb", "size": 1329992, "animations": ["attack_rifle", "cheer", "hurt", "idle", "walk"],
           "vertices": 18834, "triangles": 19985, "source": "meshy",
           "lod": "tenka.lod.glb", "lodSize": 644692, "lodVertices": 9947, "lodTriangles": 8984,
           "props": ["tenka-coilgun.glb"] }
```

**`src/art/portraits.js`.** Add to `PORTRAIT_DATA`:
```js
  tenka: { face: [50, 19], cut: 0.383 },
```

**Outfit / skin entries: none needed.**
- `feature/abilities` has no skins table.
- `feature/roster-wave`'s `src/data/skins.js` generates `tenka_default` (asset `tenka`) from the unit row by itself.
- Lobby backgrounds are also generated from `UNITS`.

**The `figurine.js` patch is byte-identical to Noa's hair-guard patch** (`../noa/patches/noa-integration.patch`, figurine hunk). Both girls
use the same `extras.eyes.hairGuard` format. Whichever lands first carries it, and the other skips that hunk. A GLB without `hairGuard`
keeps Hikari's pink rule, so Hikari is unchanged.

Why the patch is needed: without it, her eyelids paint over her blue bangs where they cross her eyes. Her hair needs its own test because her blue bangs fail the pink rule.

**The `glbChibi.js` patch.**
- It loads each `extras.props` file once (cached per file and shared by both detail levels).
- The prop gets the figurine material, a texture-tinted outline and the selection highlight.
- The prop hangs under the socket node of every instance, so the clips move it with her hand.
- A figure without `props` runs exactly as before.
- If a prop file fails to load, it is left out with a console warning; she still shows.

**Tests.** Hikari still has to have her sword, because her `weaponKind` is `slash`. A figure with `extras.props` must have:
- the socket under the named bone, with no mesh;
- the file on disk, at most 256 KB, with a single textured, quantised, WebP primitive;
- the same list in the manifest.

**When her unit row lands:**
- `glb.test.js` and `first-impressions.test.js` pick her up through `UNITS`.
- On `roster-wave`, bump `GLB_UNIT_COUNT` once for all the girls in that merge.
- Keep her out of `STANDIN_UNITS`.

## 3. Verification done

**Scratch export of `feature/abilities` 86c62a3 with the patch and binaries applied:**
- `vitest run tests/models tests/systems/first-impressions.test.js`: 6 files, 95 tests passed.
- With a throwaway unit row for `tenka` added (verification only, not in the patch): 97 passed. That includes `tenka full` and `tenka lod` in `glb.test.js`: socket, prop file, eyes, clip lengths, quantisation, WebP, sizes, and the portrait files and caps.

**Co-op sim id:** `4f42353e48d0` before and after on `feature/abilities` (main checkout: `37b5428d7657`, untouched). None of the edited files are hashed, and nothing under `src/sim`, saves or `src/online/coop` changed.

**Tool regression.** The patched `tools/meshy/build_meshy_chibi.py` (default `--profile hikari`) and the original both rebuilt Hikari from the owner's export. The outputs are **byte-identical** to the repo's `hikari.glb` and `hikari.lod.glb`, and the manifest entries match.

**Patch checks:**
- `tenka-integration.patch` applies cleanly to `feature/abilities`.
- On `roster-wave`, `glbChibi.js` applies with an offset, and the `figurine.js` hunk applies (or is already there from Noa).
- On `roster-wave`, the manifest entry and the portraits line must be added by hand (different neighbours).
- On `roster-wave`, use `4b-…` instead of `4-…` for the test.

**Renders.** These use the repo runtime: patched `src/models`, figurine look B, the texture-tinted hull outline, the `themes.js` BASE battle lights placed as in `BattleRenderer`, and the 48° ortho battle camera at 66 px per 1.224. Files in `renders/`:
- `tenka-import-sheet.png`: the overview.
- `battle-1x.png`, `battle-4x.png`, `battle-4x-attack.png`, `battle-1x-yaw.png`: next to Hikari (and Aoi) at 1x and 4x, idle and attack frames.
- `battle-4x-select.png`: selection highlight. The gun brightens with the body (+6 vs +8 mean).
- `lod-battle-1x.png`, `lod-battle-4x.png`: LOD.
- `eyes48.png` (yaw −60…60°), `eyes48-close.png`, `eyes48-hikari.png`: her eyes clear the bangs at 48° from every yaw.
- `faces.png`: open / blink / happy / hurt. Her blue bangs stay painted over closed eyes.
- `strip-48.png`, `strip-front.png`, `strip-side.png`: every clip.
- `portraits-contact.png`, `portrait-ponytail-gap-2x.png`: the six portrait files and the cut-out's ponytail gap.

## 4. What the import did (reproducible, scratch only, in `work/`)

**Rebuild commands** (inputs are in `work/in/`, not in the repo):
```
cd work
nice python3 -I tools/meshy/build_meshy_chibi.py --profile tenka --source in/tenka-rigged.glb --clips in/meshy-library-clips.glb --out out/build2 --cache cache --raw-dir out/build2
python3 -I tools/meshy/build_meshy_prop.py --source in/tenka-coilgun-raw.glb --id tenka-coilgun --unit tenka --out out/build2
```

**Scale and rig scale.**
- The Meshy API rig's 0.01 Armature scale is applied into the bones and the mesh.
- The ~0.9 m figure is scaled to the tool's 1.7 m working height, so the face window, bake cage and eye windows keep their meaning.
- Her body centre line is moved to x = 0 (the side-swept ponytail had shifted the rig).
- She is stored at half size; `unitScale` brings her to 1.224.

**Clean-up.**
- The one-frame bind-pose take is dropped.
- Bones get readable names, plus an unweighted floor `root` above `hips`.
- The mesh is welded and decimated to 20k / 9k tris, with the face and bow tie protected.
- Fresh xatlas UVs give the face 2x texel density.

**Re-bake.**
- Sources are picked by shader-socket links (her images are `Image_0`/`Image_1`; the old name pick missed metal/roughness).
- Cycles selected-to-active bakes produce the base colour, metal/roughness and normals.
- Skin and face normals are flattened.
- The hair reads clean at 1x and 4x (no Meshy UV-island colour noise).

**Eyes.**
- Amber iris and blue-violet hair predicates, with an asymmetric search window (her lashes sit close to the bangs' strand outlines).
- Grown, mirrored boxes, so the closed lid covers the lash corners.
- `hairGuard` keeps 99.7 % of the hair texels inside the eye boxes as painted, and only 0.33 % of the eye and skin texels (`work/scripts/guard_check.py`).

**Clips** (`lib/clips_tenka.py`): the library idle and walk are retargeted onto her rig. `attack_rifle`, `cheer` and `hurt` are authored with 2-bone IK on the gun arm.
- `attack_rifle`: aimed by 0.07 s, with a recoil kick and two muzzle flips. The shot reads even when `attackFx` restarts the clip every 0.45 s.
- `idle`: the coilgun is held low with its side profile to the camera.
- `cheer`: she raises it.
- Every clip has a **14° chin-up** (spine 3°, neck 6°, head 5°).

**Coilgun.**
- Its own GLB, decimated from 20k to 3k tris, re-baked, and stored at the figure's half scale.
- The figure's `prop_coilgun` socket on `hand_R` carries the grip frame (barrel and top axes) and the scale. The palm comes from the `hand_R` weights.

**Portraits.**
- The knee-length skirt edit in the art-wave master had a visible seam, so it was redone without one (`work/scripts/skirt_knee2.py`, `dot_fix.py`).
- `full`, `cut` and `cut-s` are rebuilt from the fixed master.
- The stand's matte (rembg isnet-anime) was cleaned:
  - The chalkboard seen through the ponytail gap is cut out with unmixed alpha (no green or grey fringe).
  - The lab-bench piece by her coat hem is removed.
  - Edge colours are decontaminated.
- `card`, `bust` and `thumb` show nothing below the edit (rows < 713 are identical), so they are the art-wave files unchanged.
- All six were checked at 1–4x on dark and light backgrounds.

## 5. Not finished / known

- **Her unit, kit and abilities are not included** (waiting on the tower-ability system). Until her unit row exists, the GLB tests and portrait tests skip her. The manifest entry and files are harmless on their own.
- **The `figurine.js` and `glbChibi.js` patches must ship with her files.**
  - Without the props patch, she loads with an empty hand.
  - Without the hair-guard patch, her lids paint over her bangs when she blinks.
- **No hair or coat bones.** The Meshy API rig is a 24-bone humanoid, so the ponytail and lab coat follow the head and body rigidly (no sway). They read fine in every clip.
- **LOD prop.** The coilgun has a single 3k-tri file for both detail levels, so LOD-plus-gun is 12k tris against Hikari's LOD 9.8k. A ~1.2k-tri LOD prop would need a second file and one more line in `loadProps`.
- **Portrait polish:**
  - Faint soft patches remain where the skirt pleats were blended on her right side, visible only at 2x or more on the 1200-px master.
  - The ponytail-gap edge is clean at 1–2x. At 5x the inner strand's line shows its 1-px stair steps (as painted).
- **Closed eyes at full-screen close-up** show a very faint sculpted eye-socket shading contour (geometry, not texture). It is invisible at battle, lobby and student-card sizes.
- **Integration with roster-wave / Noa:**
  - `glb.test.js` conflicts with Noa's sword hunk; use `4b-glb-test-on-roster-wave-after-noa.patch` there.
  - `tools/meshy`: Noa's import kept its tool changes in scratch copies (`../noa/work/meshy`, not in its patch). This patch is the only one that changes `tools/meshy` in the repo.
- **Commit message** for the integrator: end it with exactly
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01V3cmFg3aKCuDQGLA9Topgo
  ```
