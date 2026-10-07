# Meshy 3D chibi test: Hikari (2026-10-07)

Pipeline: Meshy image-to-image multi-view concept → multi-image-to-3D (meshy-7.1, 2K texture, ~20k triangles) → auto-rig → 4 library clips. 65 credits total (18 for concepts, 47 for model, rig and clips). Judged in the real battle scene next to the current Blender Hikari and the old Codex Hikari.

## Judge verdict

**Verdict: don't adopt Meshy 3D for the roster yet. Use a hybrid approach.**

The Meshy Hikari matches her design best, and drawn unlit it has the best anime face of the three. In battle it is the weakest version. It is about 3.5 heads tall instead of a chibi, and at 35–75 px it is thin and pale. It has no blink or expressions, the rig clips badly, and at 5 MB with about 22 MB of texture memory it is too heavy for ~20 girls on a phone. The old Codex chibis read best at battle scale, and the owner already called them cute.

I could not write `REPORT.md`: the harness blocks this subagent from writing report files, so the full content is below for the caller to save. I deleted the temporary preview page and its copied files from the repo, and `git status` is clean. A copy of the page is in `meshy-chibi/preview-src/`.

**Credits:** this review spent 0. The whole Hikari test spent 65: 18 for concepts a1 and a2 (nano-banana-pro, 9 each, read from their request bodies) and 47 for the 3D model, rig and 4 clips.

**How it was rendered:**
- **Battle view:** the real stage 1-1 terrain and the game's own battle camera (20×12 map, 1280×720 with the HUD space at top and bottom), theme lights, hero scale 1.36, default medium quality.
- **Comparison:** the current game Hikari from `buildChibi` and the old Codex Hikari (Draco GLB with its face atlas, procedural acting and weapon) stood next to the Meshy model.
- **Meshy treatments:**
  - raw: the material as Meshy shipped it;
  - toon: the game's 3-step ramp plus the game outline;
  - soft: the game's lighter face ramp plus outline;
  - unlit plus outline.

### Scores (1–10, against the target video, Blue Archive SD and the approved turnaround)

| | Game V2 | Old Codex | Meshy as delivered | Meshy unlit + outline + chibify |
|---|---|---|---|---|
| Cuteness | 4 | **7** | 4 | 6.5 |
| Face / eyes | 5 | 6 | 5 | **7.5** |
| Silhouette at battle scale | 6 | **8** | 3 | 5 |
| Texture / cel look | 5 | 6 | 4 | 6 |
| Animation | **6** | 5.5 | 4 | 4 |
| Rig | **7** | 6 | 3 | 3 |
| Size / perf, 20 on a phone | **8** | 6 | 2 | 3 (about 6 after compression) |
| Fidelity to Hikari's design | 2 (blonde, wrong design) | 6 | **9** | **9** |
| **Overall** | **5.0** | **6.5** | **4.0** | **5.5** |

### Findings
- **Proportions are the main problem.**
  - The Meshy model is about 3.5 heads tall. The concept sent to Meshy was already about 3 heads with thigh-high boots, the approved turnaround is about 2.7, and Codex is about 2.3. These head counts are estimated by eye from the screenshots.
  - At battle scale it reads as a slim white figure that blends into the white flowers and the stone path. Codex reads as a big pink head over a dark skirt, which is what looks cute at 35 px.
  - A free runtime fix helps clearly: scaling the head bone ×1.4 and the upper legs ×0.72 after each animation update gives about 2.9 heads. The long hair holds up.
- **Face.**
  - The eyes are the closest of the three to the target: heavy lashes, highlights, teal irises, blush.
  - The raw material lights shading that is already baked into the texture, so the skin goes grey-olive and the facets show. The toon ramp still double-shades. Unlit plus outline is clearly best.
  - The eyes are baked into a texture split into hundreds of tiny pieces. There is no blink and none of the game's 9 expressions. The face can't be repainted by hand, and colours will bleed between pieces at small sizes.
- **Texture.**
  - The costume detail carries over well.
  - The hair is one smooth mass. From behind it is an egg-shaped lump with a gold coat emblem printed on it, which is acceptable at battle angle.
  - The outline has small cracks where the mesh is split at texture seams.
- **Rig and animation.**
  - There are 24 body bones and no hair, skirt or coat bones.
  - In the sword slash, the right forearm and hand sweep through the face and the sleeve smears across the chest.
  - In the cheer, the arms rise through the side hair, the collar and bow stretch into a white bib, and the side hair is dragged up with the arms.
  - The fingers are fused fans. The walk is an adult catwalk. There is no sword, so the game would attach one to the right hand bone.
  - These library clips look stiff on a chibi. The game's own clips are simpler but sell the chibi better.
- **Performance** (headless software rendering, so only relative numbers matter):

| 20 girls on stage 1-1 | Game V2 (low-detail model, medium) | Codex (unsimplified) | Meshy (toon + outline) |
|---|---|---|---|
| Draw calls per girl | 6 | 13 | **2** |
| Triangles per girl | ~5.6k | ~51k | 19.4k |
| Board total (terrain ~140k triangles) | 147 calls, 366k triangles | 287 calls, 2.19M triangles | 67 calls, 916k triangles |
| Frame time (relative) | 2.0 s | 5.3 s | 4.1 s |
| Animation CPU for 20 | 0.73 ms | 0.37 ms | 0.48 ms |
| File per girl | 440 KB | 258 KB | **5.0 MB** (3.48 MB texture, 1.61 MB mesh) |
| Texture memory per unique girl | small | small, shared | **~22 MB** |

- **As shipped:** 10 unique Meshy girls on a board would need about 220 MB of texture memory, and 32 girls would be a 160 MB download.
- **After compression:** simplifying to about 8k triangles, compressing the mesh, and using a 1024² compressed texture should bring it to roughly 0.5–0.8 MB per girl.

### Recommendation: hybrid
1. **Battle roster now:** keep the old Codex 3D chibis. Use the port prototype's lower-detail version (30% of the triangles) and merged materials to cut their 13 calls and 51k triangles per girl.
2. **2D chibi art:** use Meshy image-to-image (9 credits per girl, the approved style) for the turnaround art on the student, home and card screens. That is where the owner sees close-ups and called the 3D models "ugly".
3. **One more 3D pilot first:** run a Hikari v2 for about 60–70 credits. Adopt Meshy 3D for the roster only if v2 meets all of these:
   - 2.6 heads or fewer;
   - the face is readable at 56 px on a phone;
   - no arm or face clipping in the attack;
   - a working blink;
   - a GLB of 800 KB or less.

**Fixes for the v2 pilot:**
- **Concept:**
  - 2.3–2.5 heads, stubby legs and ankle boots;
  - hands slightly away from the body;
  - hair ending above the hips, or tied;
  - coat tails no wider than the body;
  - flat light on the face;
  - no sword.
  - Keep the modesty retouch step: content blocks will likely recur for every girl and need a manual pass.
- **3D call:** same settings, but `target_polycount` 10000.
- **In game:** unlit texture plus the game outline, not the toon ramp or the raw material.
- **Post-processing (no credits):**
  - bake head ×1.35–1.4 and upper legs ×0.75 into the model;
  - attach the weapon to the right hand;
  - add a face-decal mesh using the game's face atlas, so blinks and expressions work;
  - compress the mesh and use a 1024² texture.
- **Clips:**
  - 4 per girl: a bouncy idle, the attack for her weapon, a short cheer, a hurt clip;
  - skip the walk;
  - test sharing clips across girls, since every Meshy rig uses the same 24 bone names. If that works it saves 12 credits per girl.

### Credit estimate per character

| Per girl | Lean | Expected | Worst |
|---|---|---|---|
| Concept image-to-image (9 per run) | 9 | 18 | 27 |
| Multi-image to 3D (2K texture) | 30 | 39 (about 1.3 attempts) | 60 |
| Rigging | 5 | 5 | 5 |
| Animations (3 per clip) | 12 | 12 | 18 |
| **Per girl** | **56** | **~74** | **110** |
| **32 girls** | **1,792** | **~2,370** | **3,520** |

The current balance of 1,391 covers about 18 girls at the expected cost. Shared clips would bring it to about 62 per girl (~1,980 for 32). The 2D-only route costs 9–18 per girl (288–576 for the roster).

### Key screenshots
All are in `scratchpad/meshy-chibi/`. Start with these four:
- `judge-battle-zoom.png`: battle view at maximum zoom, all four versions side by side.
- `judge-battle-phone.png`: phone size (844×390), where the girls are about 35 px tall.
- `judge-concept-vs-3d.png`: approved 2D style, the concept sent to Meshy, the Meshy model, the Meshy model with the chibify fix, and Codex.
- `judge-rig-slash.png` and `judge-rig-cheer.png`: close-ups of the rig failures.

Also there:
- `judge-battle-1280.png`, `judge-battle-zoom-back.png`, `judge-battle-phone-zoom.png`: the other battle views.
- `judge-portrait.png`, `judge-lineup.png`, `judge-toon.png`: close-up faces, full bodies at the same scale, and the four Meshy treatments.
- `judge-anim-meshy.png`, `judge-anim-meshy-close.png`, `judge-anim-meshy-back.png`, `judge-anim-game.png`: animation frame strips.
- `judge-crowd-meshy-toon.png`, `judge-crowd-codex.png`, `judge-crowd-game.png`: 20 girls of each version on the board.
- `judge-chibify-lineup.png`, `judge-chibify-lineup2.png`, `judge-chibify-battle-zoom.png`, `judge-chibify-anim.png`: the chibify fix.
- `judge-work/meshy-texture-1024.png`: the Meshy texture, split into tiny pieces.

## Pipeline log

Hikari is now a rigged, animated GLB with idle, walk, sword-slash and cheer clips, in 5.0 MB. It cost 47 credits and every step succeeded. The model is less chibi than the concept: the legs got longer and the head smaller.

**Change before the 3D call (no credits).** The critic had failed concept a2 with content blockers, so I retouched the three alpha-fixed views locally rather than build them into the model:
- **Chest:** the bust cups, centre seam and under-shading in the front view became one flat white bodice panel with straight gold trim. In the side view I cut the bust bulge back to a straight line.
- **Thighs:** the bare-thigh band became navy shorts in the front and side views.
- **Ghosts:** the grey sword-ghost bands and the grey stripes between hair strands were cleaned up.
- **Files:** `concept-a2-{front,side,back}-3dprep.png` are what went to Meshy. The script is `prep/retouch_a2.py` and the comparison is `prep/before-after.png`.

**Credits** (the balance was 1438 at the start, not the 1465 the artist reported, so other work spent 27 in between):

| Step | Task id | Balance before → after | Credits |
|---|---|---|---|
| 1. Multi-Image to 3D | `01a11781-0166-71e8-841e-a8229cadb5fa` | 1438 → 1408 | 30 |
| 2. Rigging | `01a11784-661e-7699-9e70-9f9d1fefd314` | 1408 → 1403 | 5 |
| 3. Animations (4 actions) | `01a11784-cc5b-71a5-a0e1-4c1e3a025f2f` | 1403 → 1391 | 12 |
| **Total** | | | **47** |

**Settings and choices:**
- **Step 1:** front, side, back images; ai_model latest, should_texture true, texture_resolution 2k, should_remesh true, topology triangle, target_polycount 20000, pose_mode a-pose, glb only. I left out symmetry_mode because the docs say it is deprecated and has no effect. I also set image_enhancement and remove_lighting to false to keep the drawn anime look and eye highlights.
- **Step 2:** height_meters 0.9.
- **Step 3:** I picked clips from the library previews:
  - Idle_9 (249): short loop with a narrow, feminine stance.
  - Walking_Woman (1): it walks in place, with no root motion.
  - Right_Hand_Sword_Slash (219): the right hand is empty, so the game can attach a sword to the hand bone.
  - Cheer_with_Both_Hands_Up (298): 1.8 s, chosen over Victory_Cheer, which runs 9.4 s.

**Final GLB stats** (`hikari-meshy-animated.glb`):
- **Size:** 5,238,808 bytes (5.0 MB), under the 6 MB limit.
- **Counts:** 26 nodes, 1 mesh with 1 primitive, 1 material (double-sided, no PBR maps), 1 texture (2048² JPEG, 3.48 MB).
- **Geometry:** 19,358 triangles, 28,754 vertices.
- **Scale and orientation:** 0.9 m tall, feet at y=0, facing +Z. The armature is in centimetres (scale 0.01).
- **Bones (24):** Hips, Spine02, Spine01, Spine, neck, Head, head_end, headfront, LeftShoulder, LeftArm, LeftForeArm, LeftHand, RightShoulder, RightArm, RightForeArm, RightHand, LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase, RightUpLeg, RightLeg, RightFoot, RightToeBase. There are no hair, skirt or coat bones.
- **Clips:** Idle_9 1.967 s, Walking_Woman 0.967 s, Right_Hand_Sword_Slash 1.5 s, Cheer_with_Both_Hands_Up 1.833 s.
- **Smaller file if wanted:** the texture is two-thirds of the file. Converting it to a 1k WebP with gltf-transform (`npx @gltf-transform/cli resize … --width 1024 --height 1024`, then `webp`) should bring the file to about 1.5–2 MB. I did not do this.

**Model quality, from Meshy's thumbnails and a pose sheet I rendered in three.js:**
- **Proportions:** about 3.6–4 heads tall against the concept's 2.89, with long thin legs and a smaller head.
- **Hair:** the back hair became one large egg-shaped mass.
- **Boots and face:** the boots have a small heel in side view, and a shading line runs down the middle of the face texture.
- **Content:** the chest is flat and she is fully clothed with navy shorts, so the content rule is met.
- **Rig:** all four clips play with no tearing. Hair and coat move rigidly with the body, and in the cheer the raised arms pass through the side hair.

Files are in /tmp/claude-0/-home-user/bc8e90b4-5af0
