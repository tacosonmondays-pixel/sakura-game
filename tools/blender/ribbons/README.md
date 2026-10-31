# Honor Ribbon bake (3D-flat)

Bakes the 41 Honor Ribbons in the gear icons' look (`tools/blender/items/rig.py`: emission-only toon, the fixed upper-left
light, ink hulls) into `public/art/honors/<id>-256.webp` and `-128.webp`, and rewrites `src/art/honorArt.js`.

```
blender --background --factory-startup --python-use-system-env --python tools/blender/ribbons/build_ribbons.py -- \
    [ids ...] [--pylibs DIR] [--scratch DIR] [--sheet sheet.png]
node tools/art/cosmeticsBoard.mjs            # the owner board (docs/review/cosmetics-2/board.png)
```

- `dump_ribbons.mjs` (run by the bake) reads `src/art/honors.js`: each class silhouette as polygons in the 64-unit art box,
  the colourways, and each emblem rasterised from the game's own SVG with the pre-installed Chromium.
- The camera looks straight at the art box (68 units: 2 a side for the ink), so a baked ribbon sits exactly where its SVG
  did and the CSS effect masks still fit. `src/ui/honorFx.js` draws earned ribbons from the bake (128 px up to 64 px boxes,
  256 px above); locked and secret ribbons keep the grey SVG so nothing is revealed.
- A new ribbon: add its row (`hr()` in `src/data/achievements.js`), its colourway (`HONOR_ART`) and emblem (`EMBLEMS`) in
  `src/art/honors.js`, then bake just that id. `tests/ui/cosmeticsArt.test.js` fails until every ribbon has both cuts.
- Headless Linux needs EGL for EEVEE: `apt-get install libegl1 libegl-mesa0`. Blender 5.2.3 from
  download.blender.org runs it; Pillow comes from `--pylibs` (`pip install --target DIR Pillow`). About 4 s a ribbon.
