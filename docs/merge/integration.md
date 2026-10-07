# NEW-game integration points for the "super game" merge

Area: how the NEW build (`/home/user/sakura-game`, three 0.186, Vite `base: './'`) must change to take the OLD
Codex characters as the main roster, keep the current Blender chibis as skins, add the old-only girls and use the
old illustrations. Everything below was read from the code (paths are repo-relative unless absolute; `L` = line).
The old-model anatomy itself (Draco GLBs, face atlas, procedural acting/weapons, a working r186 port prototype) is
in the sibling report `scratchpad/merge/characters.md`
§2 and §5; this report only repeats what the integration needs.

Scratch artefacts (all looked at): `merge/integ/new-student-card-844.png`, `new-student-3d-844.png` (where the skin
picker goes), `illustrations-contact.jpg`, `illustrations-grid.png` (face focal points), `pair-portraits.jpg`,
`summer-base-contact.jpg`, `roster-webp.jpg`, `sentinel-snapshot.json` (frozen palette/look of the 15 V2 designs that
become skins + the 4 that become future units), `shot.mjs` (copy of `e2e/shot.mjs` with its Vite cache redirected to
scratch so the repo stays untouched).

---

## 0. TL;DR and decisions the lead must make

1. **Skins are a pure presentation layer.** The sim never learns about them. A skin id travels profile → UI →
   `buildChibi(def, { skin })` / `cardArtSVG(def, { skin })` / `createBattleRenderer(..., { skins })`. New data file
   `src/data/skins.js`, new pure system `src/systems/skins.js`, two new profile fields (`units[id].skin`,
   `profile.skins`), `SAVE_VERSION` 2 → 3.
2. **Model choice today is hard-wired to unit id** in exactly 4 build sites and 5 preload sites (table §1.1). All of
   them go through `src/models/index.js`, so a `skin` option there plus a source dispatcher (`codex` | `blender` |
   `procedural`, later `meshy`) covers everything.
3. **Owner rule already recorded** (`docs/OWNER_REQUESTS.md` L281-283): V2 **Rei, Nami, Luna, Kaede** become future
   units (new ids/names), the other **15** V2 designs become "Sentinel Style" skins. Their GLBs stay in
   `public/models/characters/`; only the skin rows reference them.
4. **Second model source = `codex`**: 30 old GLBs under `public/models/codex/`, Draco decoder in `public/draco/`
   (NOT under `public/models/`, because the `.wasm` asset-extension deploy renames everything under `public/models`).
5. **New units: 11 now** (fuu, kohaku, noa, ena, yoriko, hana, kanna, iroha, ruri, seiran, tsubaki); **marina and
   amane wait** until they have non-swimwear models (their base GLBs and all 3 beach GLBs must not ship).
6. **Illustrations go inside the existing SVG card frame** (`<image href>` in `cardArtSVG`) so the 19 call sites
   need no change; 20 illustrations exist (6 singles + 7 two-girl pair portraits = 14 halves).
7. Decisions needed:
   - (D1) How Sentinel Style is obtained: recommended **free with the unit** (`acquisition: { type: 'withUnit' }`,
     no save data needed) vs. gifted to existing saves only / sold in the Mall.
   - (D2) New-unit acquisition: which are free stage rewards (balance gate!) vs. gacha/banner only.
   - (D3) Kanna/Yoriko/Seiran as heroes ⇒ they must be written as adult guardians (`adult: true`, test L247-250).
   - (D4) Marina (23 in the old lore) is a tower: towers must be students (`only heroes are adults`). Make her a
     student lifeguard-club girl or a hero; decide before writing her data.
   - (D5) Banners: keep one standard pool (simplest) or port the old rotating tower/hero banners (owner backlog asks
     for "banner rotation daily at 7pm CST; separate tower and hero banners").

---

## 1. Per-unit SKIN system

### 1.1 Where the 3D model is chosen today (every call site)

All builds are synchronous `buildChibi(unitDef, opts)` from `src/models/index.js` L61-87; the GLB is looked up by
**`unitDef.id`** (`getCharacter(unitDef.id, detail)` L65/L68, `loadCharacter(unitDef.id, detail)` L70/L76). Preloads
go through `preloadModels(ids, { detail })` L32-50 → `glbChibi.preloadCharacters(ids)` L110-129 (also keyed by id).

| # | File : line | What it does today | Skin change |
|---|---|---|---|
| B1 | `src/render/actors.js` L261-262 `_createTower(t)` | `buildChibi(t.def, { quality: this.quality })` for every placed girl (t.def = UnitDef from sim) | `buildChibi(t.def, { quality, skin: this.skins[t.unitId] })`; `Actors` ctor (L86) takes `skins` |
| B2 | `src/render/overlays.js` L135-170 `setGhost()` | `buildChibi(def, { quality: high→medium })` L149 for the drag ghost; clones every mesh material (L150-162) | pass `skin: this.actors.skins[unitId]` |
| B3 | `src/ui/screens/student.js` L217-246 `buildShowcase().renderStage()` | `preloadModels([unit.id], {detail:'full'})` L232 then `buildChibi(unit, {quality, detail:'full'})` L234 | preview skin state (equipped or "try-on") → both calls |
| B4 | `src/ui/lobby/secretary.js` L315-369 `show(u, …)` | `models.preloadModels([u.id], {detail:'full'})` L327, `models.buildChibi(u, {quality, detail:'full'})` L329; card-art fallback `showArt` L306-313 | `show(u, { direction, awaken, skin })`; caller `src/ui/screens/lobby.js` L144-155 |
| P1 | `src/ui/battle/controller.js` L103-113 | `preloadModels(ids, { detail })` L109 for formation + hero (5 s timeout `MODEL_TIMEOUT_MS` L26) | `preloadModels(ids, { detail, skins })`; also pass `skins` to `createBattleRenderer` L137 |
| P2 | `src/main.js` L63-73 `warmModels` | secretary at full detail, then formation | add `skins: formationSkins(profile, ids)` |
| P3 | B3/B4 preloads above | | |
| P4 | `previews/models-v2.js`, `models.js`, `enemies-v2.js`, `renderer.js`, `terrain-v2.js`, `placement-v2.js` | dev pages only | optional `?skin=` param |
| R | `src/render/actors.js` L147-157 `setQuality()` | disposes and rebuilds every model | keeps working if `this.skins` is stored |

Also on the model path: `src/render/BattleRenderer.js` L44 `createBattleRenderer(container, sim, opts)` builds
`new Actors({...})` L143 and `new Overlays({...})` L144 — add `opts.skins` (default `{}`) and pass it to `Actors`.

### 1.2 Where card art (2D) is chosen today

`cardArtSVG(unitDef, { variant, awaken })` (`src/art/cardArt.js` L56-81) is called directly from 18 places in 14 UI
files and once in `unitCard()` (`src/ui/components.js` L391-406, lead-owned), which 6 more screens use (19 call sites):

| Should show the **equipped** skin | Should show the **default** look |
|---|---|
| `students.js` L63 (via `unitCard`), `formation.js` L53 `slotTile` + L192 (`unitCard`), `stage.js` L57 `card()` → L552/L581/L587 formation slots, `battle/towerBar.js` L32, `battle/towerPanel.js` L74, `battle/heroWidget.js` L39, `battle/results.js` L128 (MVP), `student.js` L224 (showcase), `lobby/secretary.js` L312, `lobby.js` L263 (secretary picker), `missions.js` L53 + `bounty.js` L62 (hub character = secretary) | `recruit.js` L129/L324/L394 (banner, showcase, reveal), `results.js` L43 (unlock), `stage.js` L303/L610 (recommended/unlock), `campaign.js` L175, `wiki.js` L22, `backpack.js` L49, `lobby.js` L441/L501 (event slides), `mall.js` L81/L128/L164 (spark offers) |

`student.js` L268 also reads `unit.palette.accent/hair` for the showcase CSS vars → use the skin palette.

### 1.3 Data: `src/data/skins.js` (new; owner: units — plain data, importable by models, art, systems, UI)

Keep skins OUT of `UnitDef`: `tests/data/units.test.js` L253-265 asserts the exact UnitDef key set, and the sim, Blender
dump and save code all iterate UnitDefs. Proposed schema:

```js
// SkinDef
{
  id: 'hikari_sentinel',          // stable forever (stored in saves); default skins: '<unitId>_default'
  unitId: 'hikari',
  name: 'Sentinel Style',         // defaults: 'Academy Uniform' (or the unit title)
  desc: 'The Sentinel Guard dress uniform from the V2 academy.',
  kind: 'default' | 'special' | 'event' | 'shop',
  model: { source: 'codex' | 'blender' | 'procedural' /* later 'meshy' */, asset: 'hikari', recolor?: { 'Sakura hair': '#hex' } },
  palette?: {...}, look?: {...},  // overrides for SVG card art + the procedural placeholder; Sentinel Style = frozen V2 values
  art?: { illustration?: 'hikari' },  // file stem in public/art/units/ (default skins only, see §4)
  acquisition: { type: 'default' | 'withUnit' | 'shop' | 'event' | 'mission', price?: 1200, note?: '…' },
  order: 0,
}
export const SKINS = [...];                 // one default row per unit + special rows
export const SKIN_MAP;                      // id -> SkinDef
export function skinsForUnit(unitId);       // default first, then by order
export function defaultSkinId(unitId);      // `${unitId}_default`
export function getSkin(id);                // throws on unknown (like getUnit)
```

Catalogue for the first pass:

- 30 (later 32) default rows: `model.source: 'codex'`, `asset: <id>`; marina/amane rows only once re-dressed GLBs exist.
- 15 Sentinel Style rows (`model.source: 'blender'`, `asset: <id>`, `palette`/`look` copied from
  `merge/integ/sentinel-snapshot.json`): hikari, aoi, yuki, momo, akane, sango, kage, umeko, shiro, midori, suzu, raika,
  miko, hotaru, chika. Blender bytes for these 15: 9.30 MB (full + LOD).
- No rows for V2 rei/nami/luna/kaede (2.47 MB of GLBs): they are future units (new ids); a future UnitDef's default
  skin can point at `{ source: 'blender', asset: 'rei' }` because the skin `asset` is decoupled from the unit id.
- **Ordering trap:** freeze the V2 palette/look into `skins.js` BEFORE `units.js` palette/look are rewritten to the
  Codex designs (pink-haired Hikari etc.), otherwise the Sentinel Style card art silently changes. The same snapshot
  must feed the Blender pipeline: change `tools/blender/dump_units.mjs` L9-13 to dump the `blender` skin rows
  (palette/look from the skin) and `tests/tools/blender-dump.test.js` L31-37 to compare with those rows.
- Cheap future skins: the codex GLBs keep identical material slot names in every file ("Sakura hair", "Ivory satin",
  "Midnight indigo", …; characters.md §2.2), so `model.recolor` gives data-only colour variants for event/Mall skins.

### 1.4 Profile / save (`src/systems/save.js`, owner systems; `src/core/store.js` needs no change)

`migrateProfile` (L241-337) rebuilds the profile from a whitelist on **every load** (`store.load()` →
`loadSaveText` L363 → `migrateProfile`), so a new field that is not handled there is silently dropped next session.

| Change | Where |
|---|---|
| `SAVE_VERSION = 3` (older builds then refuse the newer save and keep a backup instead of stripping skins) | L11 |
| `newUnitState()` adds `skin: null` (`null` = default skin) | L41-43 |
| `createProfile()` adds `skins: []` (owned non-default skins that need ownership data: shop/event/mission) | L64-95 |
| `cleanUnit(raw, now)` → `cleanUnit(raw, now, unitId)` keeps `skin` only if `SKIN_MAP[raw.skin]?.unitId === unitId` | L136-152, caller L257 |
| `migrateProfile`: `p.skins = strList(raw.skins).filter((id) => SKIN_MAP[id])`; after that, null any `units[id].skin` the player does not own (`ownsSkin`) | after L258 |
| v2 → v3 gift (only if D1 ≠ `withUnit`): for every owned unit with a Sentinel row push `<id>_sentinel` to `p.skins`; do not equip it (old designs are the new default); queue a one-time notice via `seenIntro` key `'skins-v3'` | in `migrateProfile` when `version < 3` |
| `migrationDropsData`: also `true` when `raw.skins` contains unknown ids (so a backup is kept) | L345-351 |
| CONTRACTS §5 `Profile` | add `units[id].skin`, `skins` |

`isStubSave` (L228) and `loadSaveText` need nothing else. `tests/systems/save.test.js`: L9-23 uses `toMatchObject` for
units (still green) but add cases: skin of an unowned skin is cleared, unknown skin id → lossy, idempotency (L97-104)
with skins, v2 save → v3.

### 1.5 System: `src/systems/skins.js` (new; owner systems; pure, no DOM)

```js
export function ownsSkin(profile, skinId)       // default/withUnit: unit owned; else profile.skins.includes(id)
export function equippedSkinId(profile, unitId) // validated units[id].skin, else defaultSkinId(unitId)
export function equippedSkin(profile, unitId)   // SkinDef
export function setSkin(profile, unitId, skinId) // -> { ok, error?: 'unknown'|'wrongUnit'|'notOwned'|'unitNotOwned' }; stores null for the default
export function grantSkin(profile, skinId)      // -> { ok, isNew }
export function skinChoices(profile, unitId)    // -> [{ skin, owned, equipped, how: { short, long, offerId? } }]
export function formationSkins(profile, unitIds) // -> { [unitId]: skinId } for preloadModels / createBattleRenderer
```

UI calls `setSkin` then `store.commit('skin')` (like every other mutation). New tests `tests/systems/skins.test.js`.

### 1.6 Threading the skin through models, renderer and art

`src/models/index.js` (owner models):

```js
export function buildChibi(unitDef, opts = {}) {          // opts.skin: SkinDef | skinId | null
  const skin = resolveSkin(unitDef, opts.skin);           // getSkin(id) or defaultSkin(unitDef.id); unknown → default
  switch (skin.model.source) {
    case 'blender': return buildBlender(unitDef, skin, opts);  // today's body of buildChibi, keyed by skin.model.asset
    case 'codex':   return buildCodex(unitDef, skin, opts);    // §2
    default:        return buildProcedural(unitDef, skin, opts); // chibi.js with { ...unitDef, palette: skin.palette ?? unitDef.palette, look: skin.look ?? unitDef.look }
  }
}
export function preloadModels(ids = null, { detail = 'full', skins = {} } = {}) // groups ids by source; blender → preloadCharacters(assets), codex → preloadCodex(assets)
```

- Every built group additionally gets `userData.skinId` and `userData.source` (useful for e2e checks).
- `glbChibi.js` keeps working by asset key; only `index.js` changes which key it passes (L65/L68/L70/L76). Keep
  `instantiateCharacter(asset, unit, …)` writing `userData.unitId = unit.id` (L236) and `hashPhase(unit.id)` (L290).
- The placeholder/upgrade pattern (`upgradeInPlace` L90-101) must be generalised to `upgradeInPlace(group, instantiate)`
  so both GLB sources can replace the procedural placeholder (it relies on `group.parent` being set and on
  `userData.disposed`, L77). The procedural placeholder should use the skin's palette/look.
- `preloaded` memo (L21, L33-49): with no args it loads every manifest entry (≈ 7.7 MB today); keep the "never call
  without ids in production" rule (`main.js` L62 comment) and make the codex manifest load lazily too.

Renderer (owner renderer): `createBattleRenderer(container, sim, { quality, settings, insets, skins })` (L44) →
`new Actors({ ..., skins })` (L143) → `this.skins = skins || {}` → B1/B2 above. Contract §9 gets the new option.

Art (owner art): `cardArtSVG(unitDef, { variant, awaken, skin })`: resolve the skin; if the skin has
`palette`/`look`, draw the existing SVG from `{ ...unitDef, palette: skin.palette, look: skin.look }` (Sentinel Style
looks exactly like today's cards); if it is a default skin with an illustration, draw the illustration (§4); otherwise
the SVG from the (Codex-matched) unit palette/look. The SVG id prefix `p` (L68) must include the skin id so two
skins of one girl on the same page do not share `<defs>` ids: `ca-${slug(unit.id)}-${slug(skinId)}-${v[0]}${aw}`.

UI (meta-a / meta-b / battle-ui / lead): pass `skin: equippedSkinId(profile, id)` at every left-column site in §1.2;
`unitCard(unitId, { ..., skin })` in `components.js` L391 (lead-owned) forwards it to `cardArtSVG`; the battle UI reads
`ctx.profile` (already in ctx, controller L88-101) for the tower bar / panel / hero widget / MVP art.

### 1.7 UI to switch skins (student screen; owner meta-b)

Screenshots `merge/integ/new-student-card-844.png` and `new-student-3d-844.png`: at 844×390 the left showcase is
≈290 px wide with `‹ [Card Art | 3D Chibi] ›` on top, the stage, then a name/level row. The 5 tabs on the right
already fill the bar, so a 6th tab would scroll; the showcase must stay stable while tabs change (CONTRACTS §12).

Proposal:
- Add an **"Outfit"** pill (hanger glyph; add `outfit` to `uiIcon`/`EXTRA_GLYPHS`) to the name row of the showcase
  (`renderInfo`, student.js L253-266), showing the current skin name ("Academy Uniform" / "Sentinel Style").
- Tap → bottom sheet / `modal({ wide: true })` listing `skinChoices(profile, unit.id)`: portrait art per skin
  (`cardArtSVG(unit, { variant: 'portrait', skin })`), name, desc, state chip (Equipped / Owned / Locked + how to get
  or Mall price), buttons **Wear** (`setSkin` + `store.commit('skin')` + `showcase.refresh()` re-rendering BOTH modes —
  today `refresh()` L279 only re-renders card mode) and **Try on** (sets a preview skin without equipping and switches
  the showcase to 3D). Locked skins can be tried on.
- `view` state (L40) gains `skin` (preview); `render()` reads `params.skin` so the Mall can deep-link
  `#/student/<id>?skin=<skinId>`; the `store.on('change')` handler (L758) also refreshes on reason `'skin'`.
- Skin badge on cards: small hanger dot on `unitCard` when a non-default skin is equipped (students grid/formation).
- Lobby secretary follows the equipped skin (B4) — also when the drawn-art lobby (backlog task) replaces the 3D one.

### 1.8 Selling skins in the Mall later (`src/data/shop.js`, `src/systems/shop.js`, `src/ui/screens/mall.js`)

- `SHOP_TABS` (shop.js L10-16): add `{ id: 'wardrobe', name: 'Wardrobe', currency: 'gems', desc }`.
- Offers generated from skins: `...SKINS.filter((s) => s.acquisition.type === 'shop').map((s) => o(`skin_${s.id}`, 'wardrobe', null, 1, s.acquisition.price, 1, 'never', { skinId: s.id }))`.
  Use a new key `skinId` — `unitId` on an offer already means "spark this unit" (`buyOffer` L83-89).
- `describeOffer` (systems/shop.js L33-53): add `skinId`, `owned: ownsSkin(...)`, `soldOut` when owned.
- `buyOffer` (L75-94): branch `if (offer.skinId)` BEFORE the `unitId` branch: refuse if `!isOwned(profile, skin.unitId)`
  (error `'unitNotOwned'`, recommended), `consumeItems` gems, `grantSkin`, `bought += 1`, return `{ ok, rewards: [], skin }`.
- `mall.js` `offerCard` L70-90, buy dialog L115-129, result L160-165: an `isSkin` branch drawing
  `cardArtSVG(UNIT_MAP[unitId], { variant: 'portrait', skin })`, "Outfit for <name>", **Try on** → student deep link.
- `tests/integration/consistency.test.js` L80 ("shop only grants known items or units") must accept `skinId`.
- Event/affection skins (old Codex mechanic: `p.skins[]` + `p.equippedSkins[id]` unlocked at 100 affection in
  `summer-event.js`) map 1:1 onto `profile.skins` + `units[id].skin` — no further schema needed later.

### 1.9 Tests affected by the skin system

Change: `tests/models/glb.test.js` L26-33 + L35+ (iterate `blender` skin assets from the manifest, not `UNITS`),
`tests/tools/blender-dump.test.js` L31-37, `tests/systems/save.test.js` (new cases),
`tests/integration/consistency.test.js` L80/L95-104 (render card art for every skin too).
Add: `tests/systems/skins.test.js`, `tests/data/skins.test.js` (every unit has exactly one default row, ids unique,
`unitId` exists, `blender` assets listed in `public/models/characters/manifest.json`, `codex` assets in the codex
manifest, palette/look valid like units.test.js L267-281), `tests/models/api.test.js` (`buildChibi(u, { skin })`
for every skin in node: procedural placeholder carries `userData.skinId`), e2e smoke: equip a skin in the student
screen and check `window.__battle.renderer` tower model `userData.skinId`.

---

## 2. Second model SOURCE: Codex Draco GLBs + face atlas

### 2.1 The exact chibi interface the new code relies on (every member, every call site)

| Member | Call sites | Notes for the codex source |
|---|---|---|
| return type `THREE.Group`, feet at y=0, facing +z, ≈0.9 tall | all | old models already face +z, feet at 0; one outer scale (characters.md §5.1) |
| `.position`, `.rotation.y`, `.scale.setScalar()` | actors L271-273, L288-291 (`TOWER_SCALE 1.22`, `HERO_SCALE 1.36`, L12-13); overlays L243-247; viewer L185 | do not put the base scale on the returned group (actors overwrite it) — scale an inner node |
| `.traverse()` over meshes: `o.isMesh`, `o.castShadow`, `o.userData.isOutline`, `o.userData.fx` | actors L263-265, L161-165; overlays L150-162; util `makeSilhouette` L17-25 | outline hulls must carry `userData.isOutline = true` |
| mesh named `'face'`, `'haloGlow'` | `makeSilhouette` L19 hides them | rename the old `FacePaint` mesh to `face` |
| one material per mesh (`o.material.clone()`, copies `onBeforeCompile` + `customProgramCacheKey`) | overlays ghost L150-162 | old GLBs have 8-11 primitives/materials: merge the body to one vertex-coloured toon mesh (prototype does) |
| `.parent` / `removeFromParent()` | index.js L77 (placeholder upgrade), util L49 | |
| `userData.animate(time, dt, state)` | actors L296 (`idle` / `victory` / `disabled`), overlays L248 (`idle`), viewer L168 (`idle` / `attack` / `cheer` / `victory` / `walk` / `disabled` via `setState`), secretary L213 (`idle` / `cheer` / `pickup` / `victory`), tests (`idle`, `attack`) | map: idle→idle, attack→idle + repeating attack, cheer→cheer, victory→cheer + happy face, walk→walk, pickup→held, disabled/hurt→new slump pose + dizzy face |
| `userData.playAttack()` | actors L392-394 (sim `attack` events), viewer L148 (tap), student L241, secretary L394 | old acting uses `attackAge` (0.48 s window): store `attackAt` |
| `userData.setHighlight(bool)` | actors L396-398 ← overlays `setSelected`/`_applyHighlight` L101-117 | swap body material to a cached emissive toon (`glbChibi.js` L245-255 pattern) |
| `userData.setExpression(name\|null)` | secretary L208, L408 (`attack`, `happy`, `surprised`, `wink`, `shy`, `null`) | old atlas has 4 cells (2×2: neutral, blink, attack, happy; `offset = (i%2·0.5, i≥2 ? 0.5 : 0)`): map wink/shy/surprised→happy, hurt→attack, dizzy→blink until a 3×3 atlas with all `FACE_CELLS` is painted |
| `userData.height` | viewer `fit()` L83, secretary `measure()` L148 | 0.9 (heroes 0.9×1.07 ≈ 0.96-0.98 like V2) |
| `userData.kind === 'chibi'`, `userData.unitId` | viewer L167; `tests/models/api.test.js` L16-17 | |
| `userData.dispose()`, `userData.disposed` | actors L170; util `disposeObject` L33; index.js L77/L82-86; api test L30 | dispose only per-instance face material + cloned atlas texture |
| `userData.silhouette` | index.js L100 (re-apply after upgrade) | set by `makeSilhouette` |
| `geometry/material/texture.userData.shared = true` on template data | util `disposeObject` L36-44 | old code used `sharedChibi`/`chibiShared` flags: rename |
| a bone named `head` (`/^head$/i`) whose quaternion is rewritten every frame | secretary `findHeadBone` L154-160, pointer-follow L211-225 | old rig has `head`; old acting resets every bone each frame (OK) |
| `frustumCulled = false` on skinned meshes | glbChibi L141/L222 | bounding volumes are bind-pose |
| `quality === 'low'` → no outline hull | glbChibi L223, chibi.js L144 | same rule |
| informational: `userData.glb`, `detail`, `mixer`, `bones` | `previews/models-v2.js` L71 only | set `glb: true`, `source: 'codex'` |

Exports that must stay: `buildChibi`, `preloadModels`, `buildEnemy`, `preloadEnemies`, `makeSilhouette`,
`disposeObject`, `createModelViewer`, `CHIBI_HEIGHT` (0.9), `FACE_CELLS`, `characterUrl`, `detailFor`
(`tests/models/api.test.js` L5, L34-38). Add `codexUrl(id, detail)`.

### 2.2 Module layout (owner models)

```
public/models/codex/<id>.glb (+ optional <id>.lod.glb)   30 GLBs, ≈ 8.07 MB (all minus marina, amane, 3 beach files)
public/models/codex/manifest.json                        { id: { file, lod?, size, eye, kind, hero } }
public/models/codex/face-atlas.png                       354 KB, 1254², 2×2 cells (later a 3×3 atlas)
public/draco/draco_wasm_wrapper.js, draco_decoder.wasm   58 KB + 192 KB, copied from node_modules/three/examples/jsm/libs/draco/gltf/ (byte-identical to the old vendor copy)
src/models/codex/assets.js   manifest + loader + template prep (merge, LOD, outline normals), cache `${asset}|${detail}`
src/models/codex/acting.js   port of chibi-acting.js (+ 'hurt' pose), pure function of time
src/models/codex/weapons.js  ports of chibi-weapons.js + expansion-weapons.js
src/models/codex/face.js     iris-tint shader (palette.eyes) + expression → cell
src/models/codex/index.js    preloadCodex(assets, detail), buildCodex(unitDef, skin, opts)
src/models/index.js          source dispatcher (§1.6)
```

Lazy-load the source: `buildCodex` lives behind `await import('./codex/index.js')` inside `preloadModels` and
`DRACOLoader` behind `await import('three/addons/loaders/DRACOLoader.js')`, so Node tests and the first screen do not
pay for it; until the template is ready `buildChibi` returns the procedural placeholder (existing pattern).

### 2.3 Hosting: decoder location, `base: './'`, and the `.wasm` asset-extension hook

- **How the hook works today:** `globalThis.__SAKURA_ASSET_EXT` is not set anywhere in the repo; it is a deploy-time
  switch for the owner's preview host, which refuses `.glb` but serves `.wasm` byte-exact
  (`docs/INTEGRATION_NOTES.md` L84). When set (e.g. `'.wasm'`), every model fetch appends it:
  `glbChibi.assetExt()` L46-48 → `characterUrl` L50-52 and `manifest.json` L67; `glbEnemy.js` L46-52 + L68;
  `body.js` L61 (`chibi_base.glb`). The documented deploy step is "copy `public/models/**` with the extra extension
  appended to each file name".
- **Consequences for codex:**
  1. `codexUrl()` and the codex manifest URL must append `assetExt()` (import it from `glbChibi.js`).
  2. Because the deploy renames every file under `public/models/**`, the face atlas becomes `face-atlas.png.wasm`
     there: load it with `fetch(url + assetExt())` → `blob` → `createImageBitmap` → `new THREE.Texture(bitmap)`
     (`flipY = false`, which matches the old `atlas.flipY = false`), not with `TextureLoader` (an `<img>` request for
     an `application/wasm` response is fragile).
  3. The Draco decoder must live **outside** `public/models/` (proposal `public/draco/`): `DRACOLoader` appends the
     fixed names `draco_wasm_wrapper.js` / `draco_decoder.wasm` to `setDecoderPath()`, so a renamed copy would 404.
     `.wasm` and `.js` are served by that host anyway.
- **`base: './'`:** `public/**` is copied verbatim to `dist/`; `import.meta.env.BASE_URL` is `'./'` in builds and `'/'`
  in dev and Vitest. Build every runtime URL like `glbChibi.baseUrl()` L26-34 does: `${BASE_URL}draco/`,
  `${BASE_URL}models/codex/<id>.glb${ext}`. A relative `./draco/` resolves against the page URL (`index.html`), so it
  works on GitHub Pages (`/sakura-game/`), any folder, and the desktop exe (`http://127.0.0.1:47333/`); hash routes do
  not matter. Never port the old absolute paths (`'/assets/models/'`, `'/vendor/draco/'` in `chibi-assets.js`) — they
  break under `/sakura-game/`. Do not use Vite `?url` imports for the decoder: hashed names break `DRACOLoader`'s
  fixed file names.
- Desktop exe: `desktop/launcher.cjs` MIME map already has `.wasm`, `.png`, `.webp`, `.glb` (L25-38); the SEA embeds
  `dist/`, so it grows by the same bytes as the site.
- DRACOLoader in r186: `new DRACOLoader().setDecoderPath(base + 'draco/').setWorkerLimit(2)`; do NOT call
  `setDecoderConfig({ type: 'wasm' })` (deprecated in r186) and keep one loader alive for the session (the old code
  disposed it after a bulk load; lazy per-battle loading needs it again). Workers come from Blob URLs; fetching the
  decoder happens on the main thread, so relative paths are fine.
- Alternative with no runtime decoder: precompute quantised/meshopt GLBs + LODs offline in a browser page with
  three r186 (`GLTFExporter`), characters.md §5.6 (bpy 4.2 here cannot read Draco). Recommended for the battle LOD
  at least (see §5.2).

### 2.4 Codex template rules the integration depends on

- Body: merge the 8-11 primitives into one vertex-coloured toon `SkinnedMesh` (overlays ghost clones single
  materials; outlines and silhouette need one body); keep a slot→vertex-range table for `recolor` skins.
- LOD: `detailFor(quality)` (`glbChibi.js` L37-39) → `'full'` = original ≈ 51k tris (student, lobby, gacha);
  `'lod'` ≈ 9-17k tris (battle). Measured by the sibling: meshopt simplify 0.3 → ~17k, 0.15 → ~9.5k tris.
- Iris tint from `palette.eyes` (not the old `unit.eye` field), so recolour skins can change eyes.
- Halo: codex models have no halos; the new game's identity ("each with a floating halo", README L4) needs one —
  attach `src/models/halo.js` `buildHalo` to the `head` bone or accept haloless chibis (owner call).
- Weapon/acting kind per id comes from a models-owned table (old `kind` such as `arrow`, `ice`, `cannon`, `beam`,
  `mortar`, …), not from `UnitDef.look`.

### 2.5 Tests for the codex source

New `tests/models/codex.test.js` (header-only via `tests/models/glbHeader.js`): manifest lists every unit whose default
skin is `codex`; each file has `KHR_draco_mesh_compression`, one 27-joint skin incl. `head`, `hand.R`, a `FacePaint`
material, size ≤ 300 KB; `marina*.glb`, `amane*.glb`, `*-beach.glb` are absent. Node cannot decode Draco, so runtime
checks go into `e2e/smoke.mjs` (student 3D view → `userData.source === 'codex'`, battle towers built from codex).

---

## 3. Adding the new units (11 now, 13 later)

Old ids not yet in the new roster: fuu, kohaku, noa, ena, yoriko, hana, kanna, iroha, ruri, seiran, tsubaki
(+ marina, amane after re-dressing). Proposed mapping of each to roles/behaviours/sim gaps is in characters.md §6.3,
the missing sim mechanics in §6.4; below is what the NEW code requires of a unit and what has to change.

### 3.1 `UnitDef` schema as enforced (`src/data/units.js`, CONTRACTS §3 L96-162, `tests/data/units.test.js`)

Exactly these keys, no others (test L253-265; heroes add `hero`):
`id, name, title, kind ('tower'|'hero'), rarity ('R'|'SR'|'SSR'), adult (true ⇔ hero, L247-250), role (ROLES key),
attackType, element (null|ElementKey), placement ('land'|'water'|'amphibious'), materialFamily (feather|blade|ember|
rime|charm|rune|cog), capabilities[], pathCapabilities[] (disjoint; both must be "honest", L379-394), acquisition
({type:'starter'}|{type:'gacha'}|{type:'free', afterStage, note>10 chars}), palette (9 '#rrggbb' keys: hair,
hairShade, eyes, skin, outfit, outfitShade, accent, halo, weapon), look (8 enum keys, L44-53), bio (>80 chars),
personality, quote, tips (2-4, each >10 chars), base, paths (3 × {id,name,focus,tiers: 5 × {name,cost,desc,mods}}),
awakenPassive ({name, desc, mods}), hero? ({levelXp[9] increasing, levels 1..10 {level,desc,mods}, ult {name,desc,
unlockLevel:3, cooldown≥30, effect}})`. Optional in the sim but not allowed by the key test: `footprint`.

`base` (built with `stats()` L38-62): required `cost, behavior, damage, rate, range, projectiles, pierce, splash,
chain, maxTargets, projectileSpeed, armorPen, canHitAir, detection, status, crit, eliteMul, bossMul, barrierMul`;
optional `aura, income, trap, turret, ramp, mark, silence, reveal, knockback` (L53-57). Behaviours allowed:
`projectile, pulse, duel, beam, chain, trap, turret, none` (test L52, sim `BEHAVIORS` dispatch towers.js L617).

Data rules tested: tier costs inside `[80-450, 80-450, 500-1400, 1800-4500, 7000-16000]` and increasing (L317-328);
`behavior/attackType/element` changes only at tier 4-5 (L329-337); every tier 3+ changes more than plain numbers
(L339-348); objects introduced by upgrades arrive complete (L350-369); tower cost 150-900, hero 450-650 (L465-486;
old hero costs were 0); melee roles cannot hit air (L410-420); hero DPS at level 10 between 0.4× and 1.5× Aoi tier 4
(L534+); every girl visually distinct: unique `palette.hair`, unique `hairStyle|accessory|outfit|weapon`, unique
`hairStyle|accessory` (L287-294) — 30 girls fit (10 hair styles × 14 accessories) but must be planned.

How kits run in the sim: `resolveStats(def, { tiers, heroLevel, unitStats })` (`src/sim/mods.js`) folds base + tier
ModSets (incremental per tier) + hero level milestones + awaken passive (★3) + profile stats; only the ModSet keys
in CONTRACTS §3 L164-186 exist (`ADD_KEYS`/`MUL_KEYS`/`REPLACE_KEYS` mods.js L8-10). Behaviour functions in
`src/sim/towers.js` L379-576; ults in `src/sim/hero.js` `activateUlt` L143-180 (`nova`, `timeWarp`, `tide` only).
The sim reads `def.look.weapon` for the projectile visual (`projectileKind`, towers.js L17-31) — changing `look` to the
Codex designs changes projectile meshes (visual only).

### 3.2 Vocabulary / engine additions the new kits need (owners in brackets)

| Need | Files |
|---|---|
| New roles (summoner, displacement, aerial hunter, beam caster, purifier, mirror caster, hex caster) or map onto existing ones | `src/data/types.js` `ROLES` L90-110 (**lead**); `src/data/wiki.js` `ROLE_SUBCLASS` L40+ (meta-b; `tests/meta-b/wiki.test.js` L51 needs every role name in the wiki); role glyphs `src/art/icons/glyphs.js` L121+ (`roleIcon` falls back to marksman, icons.js L134-138) |
| New ult types (Kanna "strike strongest + shred", Seiran "aimed sweep + ground"; Yoriko can reuse `tide`) | `src/sim/hero.js` L153-177; `src/render/BattleRenderer.js` `ULT_COLORS` L28 + `'ult'` case L461-480; test `ULT` map L498 + effect checks L500-531; CONTRACTS `UltEffect` L197-199 |
| New behaviours (`mortar` aim point, `familiar`, `mirror` relay) | towers.js `BEHAVIORS`; `tests/data/units.test.js` `BEHAVIORS` L52; `student.js` `BEHAVIOR_NAMES` L39; headless `unitRole` L177-181 (autoPlan classes `none` without aura as econ!) |
| New ModSet keys (e.g. `airMul`, `ground`, `pull`, `curse`) | mods.js L8-10 + `resolveStats`; units test `modSetErrors` M table L115-148; `describeMods` student.js L69-127; CONTRACTS §3 table |
| Air-priority target mode | `TARGET_MODES` types.js L170 (**lead**); `targetScore` towers.js L235-252; tower panel target buttons |
| New capabilities (e.g. `grounding`) | `CAPABILITIES` types.js L112-131 (**lead**), `capabilityIcon`, units test `derivedCaps` L182-209 |
| Material families: old wild/arcane/spirit/martial → feather/rune/charm/blade | data only |
| Placement: old "land + water" girls (seiran, marina, amane) → `'amphibious'` (supported, placement.js L11/L129-130; test L460-463 only pins the `water` trio) | data only |

### 3.3 Gacha pool and banners (`src/systems/gacha.js`, owner systems)

Today: one standard pool, `POOL` L17-21 = every unit by rarity (incl. free units and heroes), rates 1.5/18.5/80
(`GACHA` types.js L260-267), pity 90, spark 200; `recruit.js` shows a fixed `FEATURED` list (L21) on one banner.
Adding the 11: R 4→6 (fuu, hana), SR 10→12 (ruri, tsubaki, noa — if noa stays SR), SSR 5→12 (kohaku, iroha, ena,
kanna, yoriko, seiran + later amane) ⇒ a specific SSR drops from 0.30 % to 0.125 % per pull.
- Minimum change: nothing in `gacha.js`; update `FEATURED`; Recruit Exchange spark offers auto-extend
  (`data/shop.js` L40 maps every SSR).
- Event units (marina, amane): new `acquisition: { type: 'event', event: 'summer', note }` ⇒ filter
  `POOL`/spark offers/`ratesTable` by `acquisition.type !== 'event'`; `howToGet` (`backpack.js` L121-126), wiki
  acquisition article (`wiki.js` L444-459) and the units test acquisition branch (L227-245) need the new type.
- Old banner model worth porting (D5): `standard` + one rotating featured tower banner + one featured hero banner,
  rotating daily at 19:00 America/Chicago across 5 pairs (old `live-ops.js` `bannerRotation`); featured SSR weight 1.0
  of the 1.5 % SSR share, others share 0.5; heroes only on hero banners (`fmt/gacha.js` L60-190). New files:
  `src/data/banners.js` (systems), `pull(profile, count, rng, { useTickets, bannerId })`, per-category pity
  (`profile.gacha.pityByBanner` → `save.js` L285-294 + `tests/systems/save.test.js` L18 which pins the exact
  `gacha` object), `recruit.js` banner tabs. Tests: `tests/systems/gacha.test.js` L11-17 (pool = all units),
  `tests/integration/consistency.test.js` L90-93.
- `missions.js` L359 `unitsInPool: UNITS.length` → pool size.

### 3.4 Unlocks, stages, formation

- Free recruits: `acquisition: { type: 'free', afterStage }` must match `stage.unlocks.units` both ways
  (`tests/integration/consistency.test.js` L49-58; `src/data/stages.js`, owner world). Rule: a free counter arrives
  one stage before its mechanic (CONTRACTS L324). Old grants for orientation: marsh→ruri, sky→hana+fuu, harbor→noa,
  crystal→kohaku, bamboo→iroha, grave→ena, festival→kanna+tsubaki, rift→yoriko+seiran (`fmt/expansion-roster.js` L516).
- `ownedUnits`, `grantUnit`, `recommendedFor`, formation (8 towers + 1 hero), students filters, backpack "used by",
  wiki tables all iterate `UNITS` and scale automatically. `heroes()` grows from 3 to 6.

### 3.5 Docs that enumerate the roster

`README.md` L56-61 ("the 19 girls…") and roster table L114-136; `docs/ROSTER.md` (units); CONTRACTS §3 roster
table L72-92; `docs/MODELS.md` (add a Codex section + "adding a character" for both sources); `docs/CAMPAIGN.md`
(free recruits); `docs/INTEGRATION_NOTES.md`. Wiki articles are generated from data (`wiki.js` L100-459).

### 3.6 Tests that enumerate units (all break or need extending)

| Test | Line | Why |
|---|---|---|
| `tests/data/units.test.js` `ROSTER` table + "exactly the 19 contract ids in order" | L14-34, L221-225 | new ids; size 19 |
| same, per-id contract row | L227-246 | 11-13 new rows |
| `towers()` length 16, `heroes()` = hikari/luna/nami | L559-560 | 21 towers / 6 heroes |
| `unitsByRarity` exact lists, total 19 | L563-568 | |
| `freeUnlocksByStage` exact map | L571-576 | new free girls |
| visually distinct | L287-294 | 30 unique hair hexes/signatures |
| hero ULT map + effect shape | L498, L500-531 | new heroes/ult types |
| hero DPS window | L534+ | new heroes must fit |
| BEHAVIORS / ModSet vocabulary | L52, L115-148 | any new behaviour/mod key |
| free counter for every capability | L488-495 | still true (only grows) |
| `tests/systems/gacha.test.js` pool | L11-17 | event units excluded |
| `tests/integration/consistency.test.js` pool, free-recruit agreement, card art for every unit | L49-58, L90-104 | |
| `tests/models/glb.test.js` "manifest lists every unit" + per-unit V2 GLB | L26-33, L35+ | new units have no Blender GLB |
| `tests/tools/blender-dump.test.js` dump = UNITS | L31-37 | switch to skins |
| `tests/meta-b/wiki.test.js` roles in wiki, subclass labels, free units named | L51, L66-69, L77 | new roles |
| `tests/sim/units-smoke.test.js` | all | auto; only slower |
| `tests/integration/balance.test.js` | L22-35 | `freeUnitsBefore` takes the 8 most recent free towers + most recent free hero ⇒ a new free girl changes the bot's team and can flip the Easy gate |

### 3.7 Balance tooling

`npx vitest run tests/integration/balance.test.js` (Easy gate, ~2 min) and
`BALANCE=full BALANCE_OUT=balance.md …` (full table) use `autoPlan` (`src/sim/headless.js`) with free units only;
gacha-only girls are never exercised. Add a "roster parity" check (each new unit's DPS per coin at tiers 0/3/5 vs
role peers via `resolveStats`) so 11 new kits do not ship unmeasured; `tests/sim/units-smoke.test.js` already proves
every tier resolves to finite stats.

---

## 4. Illustrations as portraits / card art

### 4.1 Where card art is generated today

`src/art/cardArt.js` `cardArtSVG()` L56-81 builds a 300×500 SVG from `palette`+`look` with the card modules in
`src/art/card/` (`rig.js` proportions, `face/hair/outfit/accessory/weapon.js`, `scene.js` background L28,
foreground/awaken L72, `fullFrame` L100, `portraitFrame` L144, `thumbCrop` L149, `thumbFrame` L155). Variants:
`full` (frame with name plate), `portrait` (3:5 card), `thumb` (square bust via `thumbCrop(r)`). Pure string output,
tested for every unit in `consistency.test.js` L95-104 (no `NaN`/`undefined`). Call sites: §1.2.

### 4.2 Plan: prefer a real illustration, keep the SVG frame

- `src/art/portraits.js` (new, art): `ILLUSTRATIONS = { hikari: { w: 820, h: 1230, alpha: true, focus: [0.57, 0.065, 0.06] }, … }`
  plus `illustrationUrl(stem, size)` using `import.meta.env.BASE_URL` (like `glbChibi.baseUrl()`).
- `cardArtSVG`: when the resolved skin is a default skin with `art.illustration`, replace `character(...)` (L22-48)
  with `<image href="…" width height preserveAspectRatio="xMidYMin slice"/>` over `background()` and under
  `foreground()` + frame. For `thumb`, set the `viewBox` to a square around `focus` (side ≈ 2.4 × face radius × h,
  top ≈ 0.42 of the side above the face centre). Hikari's file is transparent, so the generated themed background
  shows through; the others have painted backgrounds that cover it.
- Because the output is still an SVG string, all 19 call sites (`svgEl()` / `{ html }`) keep working; relative
  `href`s resolve against the page URL; in Vitest `BASE_URL` is `'/'`, so tests stay pure.
- Files: `public/art/units/<id>.webp` (original, student showcase / recruit showcase), `<id>.card.webp`
  (~600×1000, ≤ 90 KB, lists and formation) and `<id>.thumb.webp` (192², ≤ 12 KB, tower bar / panels / backpack),
  generated by a Pillow script (e.g. `tools/art/build_portraits.py` → plus `public/art/units/manifest.json` with
  sizes and focus). Without the smaller variants the 32-card students grid would pull ~7 MB of full illustrations.
- Skins: Sentinel Style rows carry `palette`/`look` and so keep today's SVG art; skins without art fall back to the
  SVG of their palette/look. The owner's newer art direction (Azur Lane-style stands, Bremerton-style info cards,
  drawn BA lobby, `docs/OWNER_REQUESTS.md` L284-285) can reuse the same `art` field later (`stand`, `lobby`).

### 4.3 What exists, and focus points (fractions of width, height; face radius ≈ 0.05-0.08 h)

| Source | Ids | Size | Face centre (approx., from `merge/integ/illustrations-grid.png`) |
|---|---|---|---|
| `oldgame/assets/hikari.webp` | hikari | 820×1230, alpha | (0.57, 0.065) — full figure, tiny face |
| `oldgame/assets/luna.webp` | luna | 810×1080 | (0.53, 0.24) |
| `oldgame/assets/nami.webp` | nami | 768×1024 | (0.50, 0.17) |
| `oldgame/assets/hotaru.webp` | hotaru | 810×1080 | (0.47, 0.20) |
| `oldgame/assets/sango.webp` | sango | 768×1024 | (0.43, 0.21) |
| `oldgame/assets/umeko.webp` | umeko | 768×1024 | (0.53, 0.20) |
| `merge/portraits/<a>-<b>.webp` (downloaded from the live site; not in the mirror) | chika/ruri, ena/kanna, fuu/hana, kaede/suzu, kohaku/tsubaki, noa/iroha, yoriko/seiran | 1536×1024 each = two 768×1024 halves (old `portraitPosition` 0 % = left girl, 100 % = right girl) | measure per half |

No illustration: aoi, rei, yuki, akane, shiro, kage, raika, miko, midori, momo (they keep SVG art). Content flags
(same as characters.md §7): `assets/roster.webp` (student sprites with cleavage, garters, fishnets — do not use),
`assets/summer/*.webp` and the summer GLBs (swimwear on chibi bodies — do not use), `hikari.webp` has bust/garter
framing — crop the `full` variant from the head down to mid-thigh or repaint; every new art batch goes through the
critic agent before the owner sees it (OWNER_REQUESTS L286).

---

## 5. Risks

### 5.1 Bundle size (measured)

| Asset group | Today | After merge |
|---|---|---|
| `public/models/characters` (V2 Blender, 19 × full + LOD) | 11.77 MB (7.86 full + 3.91 LOD) | same (9.30 MB used by 15 skins, 2.47 MB parked for 4 future units) |
| `public/models/enemies` + `chibi_base.glb` | 2.27 MB + 0.34 MB | same |
| `public/models/codex` (30 GLBs + atlas) | — | ≈ 8.07 MB + 0.35 MB (+ ~2-3 MB if precomputed LOD files ship) |
| `public/draco` | — | 0.25 MB |
| `public/art/units` (20 originals + card/thumb variants) | — | ≈ 4.5 MB originals + ≈ 2.5 MB variants |
| Total static assets | ≈ 14.4 MB | ≈ 29-32 MB |

GitHub Pages and the SEA exe are fine with this; nothing is fetched up front (models per formation, art per screen).
Cut options: ship only `lod` V2 files for skins (−~3.7 MB of full files if the student viewer may show LOD for
skins), re-encode illustrations at q75, drop the 4 parked V2 GLBs until their units exist (−2.47 MB).

### 5.2 Load time and frame cost on phones

- Battle preload: 9 codex GLBs ≈ 2.4 MB + Draco decode (2 workers) + template prep (merge, LOD simplify, outline
  normals: 60-125 ms per girl on desktop in the sibling prototype, expect 3-4× on a mid phone) ⇒ 2-5 s; the controller
  starts the battle after `MODEL_TIMEOUT_MS = 5000` with procedural placeholders that upgrade in place, so it never
  blocks, but placeholders popping into codex models mid-battle look bad. Mitigate: precompute LODs offline, prepare
  templates in idle callbacks, warm the formation from `main.js` as today, cache prepared templates for the session.
- Draw/triangle budget: codex full ≈ 51k tris and 8-11 primitives (≈18-40 meshes with weapons) per girl vs V2 full 9k
  verts / LOD 3k verts and 3 primitives; outlines double it. Battle must use the merged LOD (prototype: 30 girls =
  151 draw calls, 538k tris at LOD 0.15 + outlines; acting 1.44 ms/frame). Lobby/student may use full.
- Memory: a full codex template is ~2 MB of vertex data; keep at most formation + secretary + viewer resident.

### 5.3 Tests that will break (summary)

Roster: `tests/data/units.test.js` (L14-34, L221-245, L287-294, L498-531, L534+, L559-576), `tests/systems/gacha.test.js`
L11-17 (if event units are excluded), `tests/integration/consistency.test.js` L49-58/L80/L90-104,
`tests/meta-b/wiki.test.js` L51 (new roles), `tests/integration/balance.test.js` (team selection changes).
Models: `tests/models/glb.test.js` L26-33/L35+, `tests/tools/blender-dump.test.js` L31-37.
Save: `tests/systems/save.test.js` L18 if the gacha object gains banner pity; new skin cases.
E2E: `e2e/smoke.mjs` is unaffected by ids but should gain skin + codex checks. The deploy workflow runs the tests,
so these updates must land with the change.

### 5.4 CONTRACTS.md sections to update

§0 content rule (add: summer/beach Codex models and `roster.webp` never ship; event outfits must be non-swimwear);
§1 ownership (new: `src/data/skins.js`, `src/data/banners.js`, `src/systems/skins.js`, `src/models/codex/**`,
`public/models/codex/**`, `public/draco/**`, `src/art/portraits.js`, `public/art/units/**`, `tools/art/**`);
§2 vocabulary (new roles / target modes / capabilities / acquisition `event`); §3 roster table L72-92, UnitDef notes,
ModSet table, `HeroDef`/`UltEffect` L191-202; §5 `Profile` L369-386 (`units[id].skin`, `skins`, `SAVE_VERSION 3`),
gacha API L443-453 (banners), shop/Mall L482-507 (Wardrobe tab, `skinId` offers), new `skins.js` API block; §7 models
API L613-645 (`buildChibi` `skin` option, `preloadModels` `skins`, sources, `codexUrl`, codex hosting); §8 art API
L647-681 (`cardArtSVG` `skin`, illustration rule); §9 renderer L683-704 (`createBattleRenderer` `skins`); §11 meta-b
L747-756 (Outfit picker on student detail); §12 note that the V2 chibi section is superseded by the merge direction.

### 5.5 Other risks

- **Skin ids are save data**: never rename them; unknown ids must make `migrationDropsData` keep a backup.
- **Id clashes for future units**: V2 Rei/Nami/Luna/Kaede GLBs have `asset.extras.unit` = old id (checked by
  `glb.test.js`); their future UnitDefs need new ids and a skin row `{ source: 'blender', asset: 'rei' }`.
- **Hero adulthood** (D3/D4): codex models are one chibi body for everyone; CONTRACTS §0 makes heroes adults and
  towers students; bios/quotes must match and hero scale should be ×1.07 like V2.
- **Lead-owned files** in the change set: `src/data/types.js`, `src/ui/components.js` (`unitCard`), `src/main.js`
  (`warmModels`), `CONTRACTS.md` — schedule them with the lead.
- **Visual coupling in the sim**: `projectileKind` reads `def.look.weapon`; rewriting `look` to Codex designs changes
  projectile meshes (no balance impact, but screenshots/e2e expectations may change).
- **Halo identity**: codex chibis have no halo (§2.4).
- **Approved chibi target is Meshy-made** (`docs/art/approved/`, "THATS LITERALLY PERFECT"): codex is the right
  first default, but keep the source dispatcher open for a `meshy` source (GLB with baked clips → can reuse the
  `glbChibi.js` mixer path) so swapping defaults later is a data change in `skins.js`.

---

## 6. Suggested order of work

1. **Data & save groundwork** (units + systems): `skins.js` with default + 15 Sentinel rows (snapshot first),
   `systems/skins.js`, save v3, tests. No visible change yet (defaults resolve to `blender` until codex exists, or
   `procedural`).
2. **Model dispatcher** (models): `skin` option, `preloadModels({ skins })`, generalised placeholder upgrade; renderer
   `skins` option; controller/main/student/secretary wiring (§1.1). Tests + e2e.
3. **Codex source** (models): copy GLBs/atlas/decoder, loader + prep + acting + weapons, LODs, header tests; flip the
   default rows to `codex`; screenshot battle at 844×390 and the student viewer.
4. **Student Outfit picker + equipped-skin art everywhere** (meta-b, battle-ui, meta-a, lead for `unitCard`).
5. **Illustrations** (art): portraits pipeline + `cardArtSVG` image path + crops; critic pass on Hikari framing.
6. **Roster** (units, sim, world, systems): 11 new UnitDefs (palette/look matched to Codex designs, unique per test),
   vocabulary additions, sim features in waves (kits the sim already supports first), stage unlocks, gacha/banners,
   docs, balance table.
7. **Mall Wardrobe** (systems, meta-a) once there is a sellable skin; event outfits for Marina/Amane/Nami as
   non-swimwear summer looks.
