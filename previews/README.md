Dev-only preview pages (not part of the game build). Each area may add `previews/<area>.html` + `previews/<area>.js`
to look at its work in isolation, then screenshot it with `node e2e/shot.mjs /previews/<area>.html out.png`.

- `attacks.html` — attack FX gallery (every girl side by side) and focus view (one girl, any build); see docs/ATTACK_FX.md.
- `campus.html` — the Gate Arc campus look at night (`THEMES.campus`, src/render/city/campusProps.js) on two fixture boards from `campusMaps.js` (never in MAPS or STAGES): `?map=court|track&blackout=1&cycle=1&quality=…&cam=shelter&grey=1&clean=1&frame=battle|full&bands=1`; the "Lights out" button (or `window.__lights(on)`) sends the `ruleState` event that drives blackout dimming; `window.__terrainStats(q)` for the phone budget.
- `city.html` — the Gate Arc city look (`THEMES.city`, src/render/city/) on two fixture boards from `cityMaps.js` (never in MAPS or STAGES): `?map=downtown|canal&quality=…&cam=rift|shelter&grey=1&clean=1&frame=battle|full&bands=1` (framed like the battle by default: between its HUD and tower bar, `bands=1` draws them), plus `window.__terrainStats(q)` for the phone budget.
