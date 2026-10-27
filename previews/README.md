Dev-only preview pages (not part of the game build). Each area may add `previews/<area>.html` + `previews/<area>.js`
to look at its work in isolation, then screenshot it with `node e2e/shot.mjs /previews/<area>.html out.png`.

- `attacks.html` — attack FX gallery (every girl side by side) and focus view (one girl, any build); see docs/ATTACK_FX.md.
- `city.html` — the Gate Arc city look (`THEMES.city`, src/render/city/) on two fixture boards from `cityMaps.js` (never in MAPS or STAGES): `?map=downtown|canal&quality=…&cam=rift|shelter&grey=1&clean=1`, plus `window.__terrainStats(q)` for the phone budget.
