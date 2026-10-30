# Academy placed props (battle)

`build_props.py` builds the 3D props for the academy girls' placed objects in battle, drawn by
`src/render/placedProps.js`:

| file | props | what it is in battle |
|---|---|---|
| `azami_strip.glb` | `strip` | Azami's folding spike strip: six hinged charcoal plates with steel spikes, thistle end caps |
| `yuzuha_sentry.glb` | `sentry`, `net` | Yuzuha's fold-out tripod sentry (the band and light take her Specialist Kit colour); her Capture Net |
| `chigusa_vines.glb` | `vine`, `bed` | a thorn vine tendril (three wrap a walker her hold status holds); a thorn bed |
| `ouka_banners.glb` | `office`, `banner` | Ouka's office marker (a council banner stand beside her); a council banner (pole + pennant) |
| `wakaba_bottle.glb` | `bottle` | Wakaba's sports-drink bottle, standing by every girl her drink hydrates |
| `kinu_pins.glb` | `heatRing`, `pin`, `scissor` | Kinu's heat ring band (scaled to the ring), the sewing pins that ride it, a scissor half (two per pair) |

## Run

One Blender at a time, at low priority (bpy 4.2 needs CPython 3.11, see `../requirements.txt`):

```
python3.11 -m venv tools/blender/.venv
tools/blender/.venv/bin/pip install -r tools/blender/requirements.txt
nice tools/blender/.venv/bin/python tools/blender/props/build_props.py            # every file
nice tools/blender/.venv/bin/python tools/blender/props/build_props.py kinu_pins  # just these
```

It writes `public/models/props/<file>.glb` (committed, so CI never needs Blender) and prints each size. The whole set
is about 165 KB; `tests/models/props.test.js` holds each file under 60 KB and the set under 300 KB.

## The contract (what `src/render/placedProps.js` reads)

- Game scale: 1 unit = 1 tile, ground at y = 0, +Z = front (Blender -Y), no node scale.
- One root empty per prop, named as above; its children are the parts, named `<prop>_<part>`. A part's node origin
  is its pivot (a plate's hinge, a sentry leg's hip, the turret's yaw axis, a pennant's pole top) and its node
  transform is its rest pose in the prop. The runtime animates parts itself (unroll, fold-out, grow, drop, wave,
  fade), so there are no armatures and no clips: one file serves every instance through `InstancedMesh`.
- Materials: `body` (vertex colours; the game draws it with the girls' 3-step toon ramp and an inverted-hull
  outline) and `glow` (vertex colours, unlit, no outline: the heat ring band and the sentry light). A part named
  `*_tint` is white in the file and takes a colour per instance.
- Packing: `lib/optimize.py` (KHR_mesh_quantization), so every part's local positions stay inside [-1, 1].
- Colours come from the girls' palettes in `src/data/unitsNewGirls.js`. No textures, no text on the props.

Changing a part's name or pivot means changing `FILE_PARTS` and the draw code in `src/render/placedProps.js`.
