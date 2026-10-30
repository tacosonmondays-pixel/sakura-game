# The Oct 20 Meshy figures: Kohaku, Tsubaki and Tenka (game-ready, not wired in yet)

On Oct 20 the art wave finished three battle chibis in the same Meshy pipeline as Hikari, Noa, Hana and Ruri. The owner was told
the duo has a Hikari-level model. They were never registered in the game:
- Tenka shipped in v0.1.57 as a recoloured stand-in (`STANDIN_UNITS` in `src/models/standins.js`).
- `feature/banners` has older test-build GLBs for the duo, with no clips and no game bone names, and draws the pair as procedural
  stand-ins (`src/models/duo.js`).

These are the finished files. Nothing loads them from here. They sit outside `public/`, so Vite does not copy them into the build, and
the stand-in rule in `tests/models/glb.test.js` (a stand-in has no `<id>.glb`) stays green. No Meshy credits were spent on them
after Oct 20, and wiring them in needs none.

## The files

| file | goes to | bytes | clips |
|---|---|---|---|
| `kohaku.glb` | `public/models/characters/kohaku.glb` | 1,128,056 | idle, walk, attack_beam, cheer, hurt |
| `kohaku.lod.glb` | `public/models/characters/kohaku.lod.glb` | 537,844 | same |
| `tsubaki.glb` | `public/models/characters/tsubaki.glb` | 1,273,252 | idle, walk, attack_mortar, cheer, hurt |
| `tsubaki.lod.glb` | `public/models/characters/tsubaki.lod.glb` | 585,328 | same |
| `tenka.glb` | `public/models/characters/tenka.glb` | 1,329,992 | idle, walk, attack_rifle, cheer, hurt |
| `tenka.lod.glb` | `public/models/characters/tenka.lod.glb` | 644,692 | same |
| `tenka-coilgun.glb` | `public/models/characters/tenka-coilgun.glb` | 136,820 | (prop on a hand socket) |

What every figure has:
- Meshy source, about 20k triangles full and 9k LOD, WebP textures.
- The game's 25-joint skeleton (`root`, `hips`, `spine`, `chest`, `neck`, `head`, arms and legs with `_L`/`_R`).
- Five clips.
- `asset.extras`: `unit`, `source: 'meshy'`, `style: 'textured'`, `lod`, `height` 1.224, `unitScale` 1.44, `eyes` with a per-figure
  `hairGuard` (main's `figurine.js` already reads it), and `weaponKind`.
- The duo's two figures also carry `duo: 'kohaku_tsubaki'` and FX `anchors`: Kohaku's prism lens on `chest`, Tsubaki's mortar muzzle on
  `head`.
- Tenka's carry `props` and `chinUp`.

All sizes are inside the Meshy caps in `glb.test.js` (2.5 MB full, 1.25 MB LOD).

**Tsubaki is the eye-filled rebuild.** The owner asked on Oct 20 to fill the hollow where her eyes close. These two
files are that rebuild: same vertex and triangle counts as the first export (18,831 / 19,992 and 9,350 / 8,989), new byte sizes (above).
`DUO_READY.md` still quotes the first export's sizes (1,229,552 / 568,944); use the sizes in this table in the manifest. Kohaku did
not need the fix.

## Wiring the duo (`feature/banners`)

1. Replace the four test-build files in `public/models/characters/` with `kohaku*.glb` and `tsubaki*.glb` from here.
2. Add the two model-asset entries to `public/models/characters/manifest.json` (`DUO_READY.md` §2.1, with Tsubaki's new sizes). Like the
   `future-*` entries, they are assets, not units.
3. In `src/models/duo.js`, build each member from her GLB through the GLB runtime (`src/models/glbChibi.js`). Keep everything else:
   - one base, each girl at `DUO_SCALE` 0.85 (the layout and order notes are in `DUO_READY.md` §2.3);
   - the facing rule;
   - `playAttack`: the beam plays Kohaku's `attack_beam`, the shells play Tsubaki's `attack_mortar`; `hurt`, and `cheer` for Prismfall;
   - the procedural stand-ins only as the fallback when a GLB fails to load.

   A `kohaku_tsubaki` asset must map to the two member files in `buildChibi` and `preloadModels`, or the game requests
   `kohaku_tsubaki.glb`, gets a 404 and falls back (`DUO_READY.md` §2).
4. Tests: the member files are not units, so `glb.test.js` never sees them. Add the checks from `DUO_READY.md` §2 item 3: manifest, size
   caps, extras, clips, bones, eyes, guard and anchors.
5. Re-shoot the duo for the owner board: a wave, a close-up, and the girl page's 3D view, at 844x390 and 1280x720.

No sim file changes. This is display only and does not touch the sim id.

## Wiring Tenka (a display round on main)

1. Move `tenka.glb`, `tenka.lod.glb` and `tenka-coilgun.glb` to `public/models/characters/`.
2. Make her a GLB unit:
   - remove `'tenka'` from `STANDIN_UNITS`;
   - add her manifest entry (`TENKA_READY.md` §2);
   - in `tests/models/glb.test.js`, raise `GLB_UNIT_COUNT` from 35 to 36.
3. Load the coilgun prop. Main's `glbChibi.js` has no separate prop files yet. Port `patches/tenka/2-glbChibi-props.patch` by hand,
   with its test hunk from `4-test-docs.patch`. Without it she loads with an empty hand.
   - Skip the figurine hair-guard hunk: main already has it.
   - The other patches here were made against Oct 20 commits; read them and don't `git apply` them blindly.
4. Keep her recoloured stand-in as the fallback.
5. Board: Tenka in battle at 844x390 and 1280x720, and her girl page's 3D view.

This is display only. Her sim and kit are untouched.

## Also here

- `DUO_READY.md` and `TENKA_READY.md`: the full Oct 20 notes (verification, anchors, layout, known limits).
- `patches/`: the Oct 20 patches, kept as a reference.
