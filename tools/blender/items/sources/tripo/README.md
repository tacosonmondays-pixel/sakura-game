# Tripo gear looks (icon sources, batch 2)

The Hair Clip and Necklace set looks and the two plain looks (`docs/art/ASSET_WISHLIST.md` §1.9, P1) as 3D sources
for the item-icon pipeline (`tools/blender/items/`). They are **not wired in yet**: `src/art/itemArt.js` and
`public/art/items/` are untouched, and the two new gear slots still show the Charm icon until the item-art session
bakes these into icons. Made on the Tripo website by the owner (batch 2, `docs/art/tripo/batch-2.md`), processed by
`tools/tripo/build_tripo_prop.py --height 0.5 --tris 3000 --tex 512`: one textured mesh each (base colour WebP 512²,
int16 positions), glTF +Y up, front +Z, origin on the floor under the centre, 0.5 units tall.

| file | set (colour) | slot | look |
|---|---|---|---|
| `gear_spirit_hair.glb` | Spirit Squad (red) | Hair Clip | Pom Clip: a red hair clip with a cheer pom-pom |
| `gear_spirit_necklace.glb` | Spirit Squad (red) | Necklace | Spirit Locket: a heart locket with a megaphone charm |
| `gear_freeze_hair.glb` | Freeze Tag (ice blue) | Hair Clip | Pause-Button Clip |
| `gear_freeze_necklace.glb` | Freeze Tag (ice blue) | Necklace | Tag Timer: a pendant stopwatch |
| `gear_geometry_hair.glb` | Geometry Set (slate blue) | Hair Clip | Set-Square Clip |
| `gear_geometry_necklace.glb` | Geometry Set (slate blue) | Necklace | Crosshair Locket |
| `gear_party_hair.glb` | Party Popper (purple) | Hair Clip | Confetti Clip |
| `gear_party_necklace.glb` | Party Popper (purple) | Necklace | Party Locket (a party popper pendant) |
| `gear_treasurer_hair.glb` | Treasurer (mint) | Hair Clip | Calculator Clip |
| `gear_treasurer_necklace.glb` | Treasurer (mint) | Necklace | Coin Locket (sakura stamp) |
| `gear_power_hair.glb` | Power Bank (lime) | Hair Clip | Lightning Clip |
| `gear_power_necklace.glb` | Power Bank (lime) | Necklace | Battery Locket |
| `gear_hair.glb` | (no set) | Hair Clip | a simple sakura-flower hair clip |
| `gear_necklace.glb` | (no set) | Necklace | a simple heart locket |

Notes for the bake: the textures carry Tripo's painted shading, so a flat (unlit, or very soft) bake keeps their
colours closest; the set colours above are the wishlist's, the models follow them. The raw website downloads stay out
of git (the owner's batch-2 zips). These processed sources are committed (1.7 MB) because they were already in the
branch's history when the review asked about moving them out; the item-art session can move them once it has baked them.
